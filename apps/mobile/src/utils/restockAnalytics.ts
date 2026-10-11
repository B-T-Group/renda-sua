import { AppEventsService } from '../services/analytics/AppEventsService';

export type RestockClientEvent =
  | 'restock.alert_opened'
  | 'restock.add_to_cart_from_alert'
  | 'restock.order_from_alert';

/**
 * Client-side restock events (contract §5). Server-side events (armed,
 * disarmed, alert_sent, opt_out for bell/settings/message, ...) are emitted by
 * the backend. No PII in props: only catalog ids and the surface.
 */
export function trackRestockEvent(
  event: RestockClientEvent,
  props: { itemId?: string; inventoryItemId?: string; inStock?: boolean } = {}
): void {
  AppEventsService.track({
    eventType: event,
    subjectType: props.itemId ? 'item' : undefined,
    subjectId: props.itemId,
    metadata: {
      source: 'mobile',
      src: 'restock_alert',
      ...(props.inventoryItemId ? { inventory_item_id: props.inventoryItemId } : {}),
      ...(props.inStock !== undefined ? { in_stock: props.inStock } : {}),
    },
  });
}
