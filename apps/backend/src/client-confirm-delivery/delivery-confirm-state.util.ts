import type { DeliveryConfirmVariant } from './client-confirm-delivery.types';

interface StateOrder {
  current_status: string;
  auto_complete_deadline_at?: string | null;
  report_window_ends_at?: string | null;
}

const COMPLETABLE = new Set([
  'awaiting_client_confirmation',
  'pending_auto_complete',
]);
const PRE_DELIVERY = new Set([
  'pending',
  'pending_payment',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
]);

/** P5: the confirm screen always renders a variant, never a dead end. */
export function deliveryConfirmVariant(
  order: StateOrder,
  now: Date = new Date()
): DeliveryConfirmVariant {
  const status = order.current_status;
  if (COMPLETABLE.has(status)) return 'awaiting';
  if (status === 'disputed') return 'disputed';
  if (status === 'complete') {
    const ends = Date.parse(order.report_window_ends_at ?? '');
    return !Number.isNaN(ends) && now.getTime() <= ends
      ? 'completed_can_report'
      : 'completed';
  }
  if (PRE_DELIVERY.has(status)) return 'not_delivered_yet';
  return 'closed';
}

/** Reminder time = deadline − (auto-complete − reminder) hours; null without a deadline. */
export function momoReminderAt(
  order: StateOrder,
  market: { isStripeRail: boolean; momoAutoCompleteHours: number; momoReminderHours: number }
): string | null {
  if (market.isStripeRail) return null;
  const deadline = Date.parse(order.auto_complete_deadline_at ?? '');
  if (Number.isNaN(deadline)) return null;
  const leadMs = (market.momoAutoCompleteHours - market.momoReminderHours) * 3_600_000;
  return new Date(deadline - leadMs).toISOString();
}
