import type { BusinessOrder } from '../types/business/orders';

const BUSINESS_EARLY_CANCEL_STATUSES = [
  'pending_payment',
  'pending',
  'confirmed',
  'preparing',
] as const;

const BUSINESS_DEFERRED_CANCEL_TERMINAL_STATUSES = [
  'cancelled',
  'refunded',
  'complete',
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_approved_replace',
  'refund_rejected',
] as const;

export const BUSINESS_PRINT_LABEL_STATUSES = [
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'complete',
] as const;

export function businessMayCancelDeferredUncollectedOrder(
  order: Pick<BusinessOrder, 'current_status' | 'payment_timing' | 'payment_status'>
): boolean {
  const timing = order.payment_timing;
  if (timing !== 'pay_at_delivery' && timing !== 'pay_at_pickup') return false;
  const ps = order.payment_status;
  if (ps !== 'pending' && ps !== 'pending_payment') return false;
  return !BUSINESS_DEFERRED_CANCEL_TERMINAL_STATUSES.includes(
    order.current_status as (typeof BUSINESS_DEFERRED_CANCEL_TERMINAL_STATUSES)[number]
  );
}

export function businessMayCancelOrder(order: BusinessOrder): boolean {
  if (
    BUSINESS_EARLY_CANCEL_STATUSES.includes(
      order.current_status as (typeof BUSINESS_EARLY_CANCEL_STATUSES)[number]
    )
  ) {
    return true;
  }
  return businessMayCancelDeferredUncollectedOrder(order);
}

export function businessCanPrintLabel(order: BusinessOrder): boolean {
  return BUSINESS_PRINT_LABEL_STATUSES.includes(
    order.current_status as (typeof BUSINESS_PRINT_LABEL_STATUSES)[number]
  );
}

export function isRefundablePaymentStatus(
  status: string | null | undefined
): boolean {
  return status === 'paid' || status === 'refunded';
}

export function businessShouldShowRefund(order: BusinessOrder): boolean {
  return isRefundablePaymentStatus(order.payment_status);
}
