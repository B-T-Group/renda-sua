import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DeepLinkService } from '../notifications/deep-link.service';
import { DELIVERY_CONFIRM_SCREEN } from '../notifications/delivery-confirm-link.util';
import { NotificationOrchestrator } from '../notifications/orchestration/notification-orchestrator.service';
import type { NotifyRequest } from '../notifications/orchestration/notification.types';

type Locale = 'en' | 'fr';

interface ClientContact {
  userId: string;
  phone: string | null;
  locale: Locale;
  orderNumber: string;
}

/**
 * MoMo delivered-flow client messages. Copy follows the P&UX revision (no seller-paid,
 * no "held/protected/escrow" wording; auto-complete always mentioned).
 */
export const DELIVERY_CONFIRM_MESSAGES = {
  reminder: {
    en: (n: string, minutes: number) => ({
      title: 'Your order has arrived 📦',
      body: `Tap to confirm order ${n}. It completes automatically in ${minutes} min if you report no problem.`,
      wa: `has arrived 📦 Tap to confirm. It completes automatically in ${minutes} min if you report no problem`,
    }),
    fr: (n: string, minutes: number) => ({
      title: 'Votre commande est arrivée 📦',
      body: `Touchez pour confirmer la commande ${n}. Elle se termine automatiquement dans ${minutes} min si vous ne signalez aucun problème.`,
      wa: `est arrivée 📦 Touchez pour confirmer. Elle se termine automatiquement dans ${minutes} min si vous ne signalez aucun problème`,
    }),
  },
  autoCompleted: {
    en: (n: string, hours: number) => ({
      title: 'Your order is complete',
      body: `Order ${n} completed automatically. Something wrong? You can still report an issue for ${hours} h.`,
      wa: `completed automatically. Something wrong? You can still report an issue for ${hours} h`,
    }),
    fr: (n: string, hours: number) => ({
      title: 'Votre commande est terminée',
      body: `La commande ${n} s'est terminée automatiquement. Un souci ? Vous pouvez encore signaler un problème pendant ${hours} h.`,
      wa: `s'est terminée automatiquement. Un souci ? Vous pouvez encore signaler un problème pendant ${hours} h`,
    }),
  },
} as const;

@Injectable()
export class DeliveryConfirmNotifier {
  private readonly logger = new Logger(DeliveryConfirmNotifier.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly orchestrator: NotificationOrchestrator,
    private readonly deepLinks: DeepLinkService
  ) {}

  /** 1h reminder: push + WhatsApp, SMS fallback. Opens the confirm screen as the client. */
  async sendReminder(orderId: string, minutesLeft: number): Promise<boolean> {
    const contact = await this.contact(orderId);
    if (!contact) return false;
    const copy = DELIVERY_CONFIRM_MESSAGES.reminder[contact.locale](
      contact.orderNumber,
      Math.max(1, Math.round(minutesLeft))
    );
    return this.send(
      this.request('order.delivery_confirm.reminder', orderId, contact, copy, 'reminder')
    );
  }

  async sendAutoCompleted(orderId: string, reportHours: number): Promise<boolean> {
    const contact = await this.contact(orderId);
    if (!contact) return false;
    const copy = DELIVERY_CONFIRM_MESSAGES.autoCompleted[contact.locale](
      contact.orderNumber,
      reportHours
    );
    return this.send(
      this.request(
        'order.delivery_confirm.auto_completed',
        orderId,
        contact,
        copy,
        'auto_completed'
      )
    );
  }

  private request(
    type: NotifyRequest['type'],
    orderId: string,
    contact: ClientContact,
    copy: { title: string; body: string; wa: string },
    kind: string
  ): NotifyRequest {
    const links = this.deepLinks.deliveryConfirm(orderId);
    return {
      type,
      category: 'actionable',
      recipientUserId: contact.userId,
      locale: contact.locale,
      preferenceCategory: 'order_updates',
      entityType: 'order',
      entityId: orderId,
      dedupeKey: `order.delivery_confirm.${kind}:${orderId}`,
      allowSmsFallback: true,
      channels: {
        push: {
          title: copy.title,
          body: copy.body,
          data: {
            type: 'order_status',
            status: 'awaiting_client_confirmation',
            orderId,
            orderNumber: contact.orderNumber,
            url: links.path,
            persona: 'client',
            targetPersona: 'client',
            screen: DELIVERY_CONFIRM_SCREEN,
            source: 'push',
          },
        },
        whatsapp: {
          templateKey: 'order_status_client',
          ctaUrl: `${links.universal}&src=wa`,
          variables: { orderNumber: contact.orderNumber, statusLabel: copy.wa },
        },
        ...(contact.phone
          ? {
              sms: {
                to: contact.phone,
                body: `Rendasua: ${copy.body} ${links.universal}&src=sms`,
              },
            }
          : {}),
      },
    };
  }

  private async send(request: NotifyRequest): Promise<boolean> {
    try {
      const result = await this.orchestrator.notify(request);
      return result.attempts.some((a) => a.status === 'sent' || a.status === 'delivered');
    } catch (error: any) {
      this.logger.warn(`${request.type} failed for ${request.entityId}: ${error?.message}`);
      return false;
    }
  }

  private async contact(orderId: string): Promise<ClientContact | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: {
        order_number?: string | null;
        client?: {
          user_id?: string | null;
          user?: { phone_number?: string | null; preferred_language?: string | null } | null;
        } | null;
      } | null;
    }>(
      `query DeliveryConfirmContact($id: uuid!) {
        orders_by_pk(id: $id) {
          order_number
          client { user_id user { phone_number preferred_language } }
        }
      }`,
      { id: orderId }
    );
    const order = res.orders_by_pk;
    const userId = order?.client?.user_id;
    if (!order || !userId) return null;
    const lang = (order.client?.user?.preferred_language || '').toLowerCase();
    return {
      userId,
      phone: order.client?.user?.phone_number?.trim() || null,
      locale: lang.startsWith('fr') ? 'fr' : 'en',
      orderNumber: order.order_number || orderId.slice(0, 8),
    };
  }
}
