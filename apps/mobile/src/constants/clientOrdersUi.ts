import type { Order } from '../types/agent';
import type { ThemeColors } from '../theme';

/** Client orders list: same tab → status mapping as web `OrdersPage` tabGroups. */
export type ClientOrderTab = 'all' | 'pending' | 'active' | 'delivered' | 'cancelled';

export const CLIENT_ORDER_TAB_STATUSES: Record<
  'pending' | 'active' | 'delivered' | 'cancelled',
  readonly string[]
> = {
  pending: ['pending', 'pending_payment'],
  active: [
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'assigned_to_agent',
    'picked_up',
    'in_transit',
    'out_for_delivery',
    'refund_requested',
    'refund_approved_full',
    'refund_approved_partial',
    'refund_approved_replace',
    'refund_processing',
  ],
  delivered: ['delivered', 'complete'],
  cancelled: ['cancelled', 'failed', 'refunded'],
};

/** Higher rank = show first (aligned with web `CLIENT_ORDER_STATUS_RELEVANCE`). */
export const CLIENT_ORDER_STATUS_RELEVANCE: Record<string, number> = {
  out_for_delivery: 100,
  in_transit: 95,
  picked_up: 90,
  assigned_to_agent: 85,
  ready_for_pickup: 75,
  preparing: 65,
  confirmed: 55,
  pending_payment: 48,
  pending: 42,
  delivered: 30,
  complete: 12,
  refund_requested: 14,
  refund_approved_full: 13,
  refund_approved_partial: 13,
  refund_approved_replace: 13,
  refund_rejected: 11,
  failed: 8,
  refunded: 8,
  cancelled: 0,
};

/** Theme-aware status tint for list rows / chips. */
export function statusTint(status: string, colors: ThemeColors): string {
  switch (status) {
    case 'pending':
    case 'pending_payment':
      return colors.warningTint;
    case 'confirmed':
    case 'preparing':
      return colors.infoTint;
    case 'ready_for_pickup':
    case 'assigned_to_agent':
    case 'picked_up':
    case 'in_transit':
    case 'out_for_delivery':
      return colors.primaryTint;
    case 'delivered':
    case 'complete':
      return colors.successTint;
    case 'cancelled':
    case 'failed':
      return colors.errorTint;
    case 'refunded':
      return colors.warningTint;
    default:
      return colors.pageBackground;
  }
}

export function filterOrdersByTab(orders: Order[], tab: ClientOrderTab): Order[] {
  if (tab === 'all') return orders;
  const statuses = CLIENT_ORDER_TAB_STATUSES[tab];
  return orders.filter((o) => statuses.includes(o.current_status || ''));
}
