import type { BusinessOrder } from '../types/business/orders';
import type { Order, OrderItem } from '../types/agent';
import { orderItemImageUrl, orderLineItemsQuantitySum } from './clientOrderListDisplay';
import { formatPreferredDate, formatTimeSlotValue } from './deliveryWindowUtils';

export function businessOrderItemTitle(order: BusinessOrder): string {
  const lines = order.order_items ?? [];
  if (lines.length === 0) return '';
  const first = lineItemLabel(lines[0]);
  if (lines.length === 1) return first;
  return `${first} +${lines.length - 1}`;
}

function lineItemLabel(line: OrderItem): string {
  const name = line.item_name?.trim() || line.item?.name?.trim();
  const variant = line.variant_name?.trim();
  const label = name
    ? variant
      ? `${name} · ${variant}`
      : name
    : `Item`;
  const qty = Number(line.quantity) || 1;
  return qty > 1 ? `${label} ×${qty}` : label;
}

export function businessOrderAgentLabel(order: BusinessOrder): string | null {
  const u = order.assigned_agent?.user;
  if (!u) return null;
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return name || u.email || null;
}

export function businessOrderPickupLocation(order: BusinessOrder): string {
  const loc = order.business_location;
  if (!loc) return '';
  const city = loc.address?.city?.trim();
  return [loc.name, city].filter(Boolean).join(' · ');
}

export function businessOrderUnitsCount(order: BusinessOrder): number {
  return orderLineItemsQuantitySum(order as Order);
}

export function businessOrderLineCount(order: BusinessOrder): number {
  return order.order_items?.length ?? 0;
}

/** True for customer store-pickup (not agent collection for delivery). */
export function isStorePickupOrder(order: {
  fulfillment_method?: string | null;
  payment_timing?: string | null;
}): boolean {
  return (
    order.fulfillment_method === 'pickup' ||
    order.payment_timing === 'pay_at_pickup'
  );
}

type TimeWindow = NonNullable<Order['delivery_time_windows']>[number] & {
  is_confirmed?: boolean | null;
};

/** Prefer order-linked window, then confirmed, else first. */
export function resolveOrderTimeWindow(order: Order): TimeWindow | null {
  const windows = (order.delivery_time_windows ?? []) as TimeWindow[];
  if (!windows.length) return null;
  const linkedId = (order as BusinessOrder).delivery_time_window_id;
  if (linkedId) {
    const linked = windows.find((w) => w.id === linkedId);
    if (linked) return linked;
  }
  const confirmed = windows.find((w) => w.is_confirmed);
  return confirmed ?? windows[0] ?? null;
}

export function formatOrderTimeWindowLabel(order: Order, locale: string): string | null {
  if ((order as BusinessOrder).fulfillment_timing === 'asap' || order.fulfillment_timing === 'asap') {
    return locale.startsWith('fr') ? 'Dès que possible' : 'As soon as possible';
  }
  const w = resolveOrderTimeWindow(order);
  if (!w) return null;
  const datePart = w.preferred_date ? formatPreferredDate(w.preferred_date, locale) : '';
  const timePart =
    w.time_slot_start && w.time_slot_end
      ? `${formatTimeSlotValue(w.time_slot_start, locale)} – ${formatTimeSlotValue(w.time_slot_end, locale)}`
      : w.slot?.slot_name?.trim() || '';
  const parts = [datePart, timePart].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Up to 3 distinct line image URLs for stacked thumbs. */
export function orderListThumbUrls(order: Order, max = 3): string[] {
  const urls: string[] = [];
  for (const line of order.order_items ?? []) {
    const uri = orderItemImageUrl(line);
    if (uri && !urls.includes(uri)) urls.push(uri);
    if (urls.length >= max) break;
  }
  return urls;
}
