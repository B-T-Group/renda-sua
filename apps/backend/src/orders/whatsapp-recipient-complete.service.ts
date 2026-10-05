import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { phonesEqual } from '../notifications/merchant-order-notify.util';
import {
  recipientCompleteLocale,
  recipientCompleteReply,
  type RecipientCompleteOutcome,
} from './recipient-pickup-complete.util';
import { OrdersService } from './orders.service';

const BOUND_ORDER_QUERY = `
  query WaRecipientCompleteByWamid($wamid: String!) {
    notification_events(
      where: {
        provider_message_id: { _eq: $wamid }
        notification_type: { _eq: "order.recipient.complete_pickup" }
        entity_type: { _eq: "order" }
        entity_id: { _is_null: false }
      }
      order_by: { created_at: desc }
      limit: 1
    ) { entity_id }
  }
`;

const RECIPIENT_ORDER_QUERY = `
  query WaRecipientCompleteOrder($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      order_number
      recipient_phone
      fulfillment_country
    }
  }
`;

type RecipientOrder = {
  id: string;
  order_number?: string | null;
  recipient_phone?: string | null;
  fulfillment_country?: string | null;
};

@Injectable()
export class WhatsAppRecipientCompleteService {
  private readonly logger = new Logger(WhatsAppRecipientCompleteService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    @Inject(forwardRef(() => OrdersService))
    private readonly orders: OrdersService
  ) {}

  async handleComplete(params: {
    fromPhone: string;
    contextMessageId?: string | null;
  }): Promise<{ handled: boolean; message: string }> {
    const orderId = await this.boundOrderId(params.contextMessageId);
    const order = orderId ? await this.loadOrder(orderId) : null;
    if (!order || !phonesEqual(params.fromPhone, order.recipient_phone)) {
      return { handled: true, message: recipientCompleteReply('unmatched', 'en') };
    }
    return this.settle(order);
  }

  private async settle(
    order: RecipientOrder
  ): Promise<{ handled: boolean; message: string }> {
    const locale = recipientCompleteLocale(order.fulfillment_country);
    try {
      const outcome = await this.orders.completeDiasporaRecipientPickup(order.id);
      return { handled: true, message: this.reply(outcome, locale, order) };
    } catch (error: any) {
      this.logger.warn(
        `Recipient complete failed for ${order.id}: ${error?.message ?? error}`
      );
      return {
        handled: true,
        message: recipientCompleteReply('failed', locale, order.order_number),
      };
    }
  }

  private reply(
    outcome: RecipientCompleteOutcome,
    locale: 'en' | 'fr',
    order: RecipientOrder
  ): string {
    return recipientCompleteReply(outcome, locale, order.order_number);
  }

  private async boundOrderId(wamid?: string | null): Promise<string | null> {
    const id = wamid?.trim();
    if (!id) return null;
    const res = await this.hasura.executeQuery<{
      notification_events: Array<{ entity_id?: string | null }>;
    }>(BOUND_ORDER_QUERY, { wamid: id });
    return res.notification_events?.[0]?.entity_id?.trim() || null;
  }

  private async loadOrder(orderId: string): Promise<RecipientOrder | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: RecipientOrder | null;
    }>(RECIPIENT_ORDER_QUERY, { orderId });
    return res.orders_by_pk ?? null;
  }
}
