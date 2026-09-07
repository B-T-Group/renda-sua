import type { Order, OrderItem } from '../types/agent';
import type { Theme } from '../theme';

function pickBestImageUrl(
  imgs: NonNullable<OrderItem['item']>['item_images'] | undefined | null
): string | null {
  if (!imgs?.length) return null;
  const main = imgs.find((i) => i.image_type === 'main');
  const best = main ?? imgs[0];
  return (best?.display_url ?? best?.image_url)?.trim() || null;
}

export function orderListHeroImageUrl(order: Order): string | null {
  for (const line of order.order_items ?? []) {
    const snap = line.variant_snapshot?.image_url?.trim();
    if (snap) return snap;
    const u = pickBestImageUrl(line.item?.item_images);
    if (u) return u;
  }
  return null;
}

/** Best image URL for a single order line (variant snapshot first, then item images). */
export function orderItemImageUrl(item: OrderItem): string | null {
  const snap = item.variant_snapshot?.image_url?.trim();
  if (snap) return snap;
  return pickBestImageUrl(item.item?.item_images);
}

export function formatOrderDeliveryScheduleLabel(order: Order): string | null {
  const windows = order.delivery_time_windows;
  if (windows?.length) {
    const parts = windows.map((w) => {
      const bits = [
        w.preferred_date,
        w.slot?.slot_name,
        w.time_slot_start && w.time_slot_end ? `${w.time_slot_start}–${w.time_slot_end}` : null,
      ].filter(Boolean);
      return bits.join(' · ');
    });
    return parts.filter(Boolean).join(' | ') || null;
  }
  const pref = order.preferred_delivery_time?.trim();
  return pref || null;
}

export function deliveryAddressOneLine(order: Order): string {
  const a = order.delivery_address;
  if (!a) return '';
  return [a.address_line_1, a.city].filter(Boolean).join(', ');
}

export function orderLineItemsQuantitySum(order: Order): number {
  return (order.order_items ?? []).reduce((sum, oi) => sum + (Number(oi.quantity) || 0), 0);
}

export function orderStatusStripeColor(status: string, colors: Theme['colors']): string {
  switch (status) {
    case 'pending':
    case 'pending_payment':
      return colors.warning.main;
    case 'confirmed':
      return colors.info.main;
    case 'preparing':
      return colors.primary.main;
    case 'ready_for_pickup':
      return colors.secondary.main;
    case 'assigned_to_agent':
    case 'picked_up':
    case 'in_transit':
      return colors.primary.main;
    case 'out_for_delivery':
      return colors.secondary.main;
    case 'delivered':
    case 'complete':
      return colors.success.main;
    case 'cancelled':
    case 'failed':
      return colors.error.main;
    case 'refunded':
    case 'refund_requested':
    case 'refund_approved_full':
    case 'refund_approved_partial':
    case 'refund_approved_replace':
      return colors.warning.main;
    case 'refund_rejected':
      return colors.error.main;
    default:
      return colors.divider;
  }
}
