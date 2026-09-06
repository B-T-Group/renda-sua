import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { SmsService } from '../sms/sms.service';
import { normalizeLanguage, type EmailLocale } from './email-template-data';
import {
  smsRecipientDeliveryPin,
  smsRecipientOrderCancelled,
  smsRecipientOrderComplete,
  smsRecipientOrderConfirmed,
  smsRecipientOrderPlaced,
  smsRecipientOrderReady,
  smsRecipientOutForDelivery,
  type RecipientSmsContext,
} from './order-recipient-sms.messages';
import { WhatsAppChannel } from './orchestration/channels/whatsapp.channel';

/** Order fields needed to reach a recipient who has no Rendasua account. */
export interface OrderRecipientContact {
  orderId: string;
  orderNumber: string;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientNotifyWhatsapp: boolean;
  isThirdPartyRecipient: boolean;
  payerName: string | null;
  payerPhone: string | null;
  businessName: string | null;
  fulfillmentCountry: string | null;
  fulfillmentMethod: string | null;
}

/** Statuses a recipient is told about. Anything else stays payer-only. */
const NOTIFIED_STATUSES = new Set([
  'pending',
  'confirmed',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'complete',
  'cancelled',
]);

/** French-first markets; recipients have no profile language to read. */
const FRENCH_COUNTRIES = new Set(['GA', 'CM', 'CI', 'SN', 'CD', 'CG', 'BJ', 'TG']);

/**
 * An order can reach the same milestone from two directions (the payment
 * finalize path and the queued status-change path), so recent sends are
 * remembered briefly to avoid texting a recipient twice.
 */
const DEDUPE_TTL_MS = 10 * 60 * 1000;

const ORDER_RECIPIENT_QUERY = `
  query GetOrderRecipientContact($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      order_number
      recipient_name
      recipient_phone
      recipient_notify_whatsapp
      is_third_party_recipient
      payer_name
      payer_phone
      fulfillment_country
      fulfillment_method
      business { name }
    }
  }
`;

/**
 * Delivers order updates straight to the local recipient of a diaspora order.
 *
 * The regular fan-out in NotificationsService is keyed on `users.id` and reads
 * per-user preferences, which a recipient without an account cannot have. This
 * service therefore talks to the phone number on the order directly: WhatsApp
 * when opted in, Orange SMS otherwise. Every send is best effort — a failed
 * message must never fail or roll back an order.
 */
@Injectable()
export class OrderRecipientNotificationsService {
  private readonly logger = new Logger(OrderRecipientNotificationsService.name);
  private readonly recentSends = new Map<string, number>();

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly smsService: SmsService,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly configService: ConfigService
  ) {}

  /** Notifies the recipient about a status change, if this order has one. */
  async notifyStatusChange(orderId: string, status: string): Promise<void> {
    if (!NOTIFIED_STATUSES.has(status)) return;
    if (this.alreadySent(`status:${orderId}:${status}`)) return;
    const contact = await this.loadContact(orderId);
    if (!contact) return;
    const locale = this.localeFor(contact);
    const body = this.smsBodyForStatus(status, this.smsContext(contact, locale));
    if (!body) return;
    await this.deliver(contact, {
      locale,
      smsBody: body,
      whatsapp: this.whatsAppPayloadForStatus(status, contact, locale),
    });
  }

  /** Sends the delivery PIN to the recipient so the agent can be verified. */
  async notifyDeliveryPin(orderId: string, pin: string): Promise<void> {
    const trimmedPin = pin?.trim();
    if (!trimmedPin) return;
    if (this.alreadySent(`pin:${orderId}:${trimmedPin}`)) return;
    const contact = await this.loadContact(orderId);
    if (!contact) return;
    const locale = this.localeFor(contact);
    await this.deliver(contact, {
      locale,
      smsBody: smsRecipientDeliveryPin(
        this.smsContext(contact, locale),
        trimmedPin
      ),
      whatsapp: {
        templateKey: 'delivery_pin',
        variables: { pin: trimmedPin },
      },
    });
  }

  /**
   * Loads the recipient contact, returning null whenever the recipient is the
   * payer (then the normal notification path already covers them) or when the
   * recipient phone duplicates the payer's.
   */
  private async loadContact(
    orderId: string
  ): Promise<OrderRecipientContact | null> {
    let order: any;
    try {
      const result = await this.hasuraSystemService.executeQuery(
        ORDER_RECIPIENT_QUERY,
        { orderId }
      );
      order = result?.orders_by_pk;
    } catch (error: any) {
      this.logger.warn(
        `Recipient contact lookup failed for order ${orderId}: ${error?.message ?? error}`
      );
      return null;
    }
    if (!order?.is_third_party_recipient) return null;

    const recipientPhone = order.recipient_phone?.trim() || null;
    if (!recipientPhone) return null;
    if (this.samePhone(recipientPhone, order.payer_phone)) return null;

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      recipientName: order.recipient_name ?? null,
      recipientPhone,
      recipientNotifyWhatsapp: order.recipient_notify_whatsapp === true,
      isThirdPartyRecipient: true,
      payerName: order.payer_name ?? null,
      payerPhone: order.payer_phone ?? null,
      businessName: order.business?.name ?? null,
      fulfillmentCountry: order.fulfillment_country ?? null,
      fulfillmentMethod: order.fulfillment_method ?? null,
    };
  }

  /** WhatsApp first when opted in, then SMS. Failures are logged, not thrown. */
  private async deliver(
    contact: OrderRecipientContact,
    message: {
      locale: EmailLocale;
      smsBody: string;
      whatsapp: { templateKey: string; variables: Record<string, string> } | null;
    }
  ): Promise<void> {
    const phone = contact.recipientPhone as string;
    if (contact.recipientNotifyWhatsapp && message.whatsapp) {
      const sent = await this.sendWhatsApp(contact, phone, message);
      if (sent) return;
    }
    await this.sendSms(phone, message.smsBody, contact.orderNumber);
  }

  private async sendWhatsApp(
    contact: OrderRecipientContact,
    phone: string,
    message: {
      locale: EmailLocale;
      whatsapp: { templateKey: string; variables: Record<string, string> } | null;
    }
  ): Promise<boolean> {
    if (!message.whatsapp) return false;
    try {
      const result = await this.whatsAppChannel.send({
        to: phone,
        locale: message.locale,
        entityType: 'order',
        entityId: contact.orderId,
        payload: {
          templateKey: message.whatsapp.templateKey,
          variables: message.whatsapp.variables,
        },
      });
      return result.status === 'sent';
    } catch (error: any) {
      this.logger.warn(
        `Recipient WhatsApp failed for order ${contact.orderNumber}: ${error?.message ?? error}`
      );
      return false;
    }
  }

  private async sendSms(
    to: string,
    message: string,
    orderNumber: string
  ): Promise<void> {
    const smsEnabled =
      this.configService.get<Configuration['sms']>('sms')?.enabled === true;
    if (!smsEnabled) {
      this.logger.log(
        `Recipient SMS skipped for order ${orderNumber}: SMS_ENABLED is off`
      );
      return;
    }
    try {
      const result = await this.smsService.sendSms({ to, message });
      if (!result.success) {
        this.logger.warn(
          `Recipient SMS failed for order ${orderNumber}: ${result.error ?? 'unknown'}`
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `Recipient SMS error for order ${orderNumber}: ${error?.message ?? error}`
      );
    }
  }

  private smsContext(
    contact: OrderRecipientContact,
    locale: EmailLocale
  ): RecipientSmsContext {
    return {
      orderNumber: contact.orderNumber,
      businessName: contact.businessName,
      payerName: contact.payerName,
      locale,
    };
  }

  private smsBodyForStatus(
    status: string,
    ctx: RecipientSmsContext
  ): string | null {
    switch (status) {
      case 'pending':
        return smsRecipientOrderPlaced(ctx);
      case 'confirmed':
        return smsRecipientOrderConfirmed(ctx);
      case 'ready_for_pickup':
        return smsRecipientOrderReady(ctx);
      case 'out_for_delivery':
        return smsRecipientOutForDelivery(ctx);
      case 'delivered':
      case 'complete':
        return smsRecipientOrderComplete(ctx);
      case 'cancelled':
        return smsRecipientOrderCancelled(ctx);
      default:
        return null;
    }
  }

  /**
   * Dedicated appealed Meta templates for key milestones; other statuses use
   * approved `rs_recipient_order_update`. WhatsApp only when
   * `recipient_notify_whatsapp` is true.
   */
  private whatsAppPayloadForStatus(
    status: string,
    contact: OrderRecipientContact,
    locale: EmailLocale
  ): { templateKey: string; variables: Record<string, string> } | null {
    const orderNumber = contact.orderNumber;
    const payerName = (contact.payerName || '').trim() || '-';
    const storeName = (contact.businessName || '').trim() || '-';

    switch (status) {
      case 'pending':
        return {
          templateKey: 'recipient_order_placed',
          variables: { payerName, storeName, orderNumber },
        };
      case 'out_for_delivery':
        return {
          templateKey: 'recipient_out_for_delivery',
          variables: { orderNumber },
        };
      case 'ready_for_pickup':
        return {
          templateKey: 'recipient_order_ready',
          variables: { orderNumber, storeName },
        };
      case 'confirmed':
      case 'delivered':
      case 'complete':
      case 'cancelled':
        return {
          templateKey: 'recipient_order_update',
          variables: {
            orderNumber,
            statusLabel: this.statusLabel(status, locale),
          },
        };
      default:
        return null;
    }
  }

  private statusLabel(status: string, locale: EmailLocale): string {
    const en: Record<string, string> = {
      confirmed: 'confirmed',
      delivered: 'delivered',
      complete: 'delivered',
      cancelled: 'cancelled',
    };
    const fr: Record<string, string> = {
      confirmed: 'confirmée',
      delivered: 'livrée',
      complete: 'livrée',
      cancelled: 'annulée',
    };
    const map = locale === 'fr' ? fr : en;
    return map[status] ?? status.replace(/_/g, ' ');
  }

  private localeFor(contact: OrderRecipientContact): EmailLocale {
    const country = contact.fulfillmentCountry?.trim().toUpperCase();
    if (country && FRENCH_COUNTRIES.has(country)) return 'fr';
    if (country) return 'en';
    return normalizeLanguage(null);
  }

  /** Records the key and reports whether it was already sent recently. */
  private alreadySent(key: string): boolean {
    const now = Date.now();
    for (const [seen, at] of this.recentSends) {
      if (now - at > DEDUPE_TTL_MS) this.recentSends.delete(seen);
    }
    if (this.recentSends.has(key)) return true;
    this.recentSends.set(key, now);
    return false;
  }

  /** Compares phones on digits so `+241 07…` and `24107…` match. */
  private samePhone(a?: string | null, b?: string | null): boolean {
    const digitsA = (a ?? '').replace(/\D/g, '');
    const digitsB = (b ?? '').replace(/\D/g, '');
    if (!digitsA || !digitsB) return false;
    return digitsA === digitsB;
  }
}
