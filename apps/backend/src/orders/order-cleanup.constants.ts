/** System cancellation reason: unpaid pending_payment past grace. */
export const CANCEL_REASON_PAYMENT_NOT_COMPLETED = 20;

/** System cancellation reason: ready_for_pickup past pickup/delivery window. */
export const CANCEL_REASON_NOT_PICKED_UP_IN_TIME = 21;

/** delivery_failure_reasons.reason_key for missed window / stuck mid-fulfillment. */
export const FAILURE_REASON_DELIVERY_WINDOW_MISSED = 'delivery_window_missed';

/**
 * Minutes to leave pending_payment alone after payment_failed_at
 * (matches wait-handler order.payment_failed schedule of 180).
 */
export const PAYMENT_FAILED_GRACE_MINUTES = 180;

export const MID_FULFILLMENT_STATUSES = [
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
] as const;

export type MidFulfillmentStatus = (typeof MID_FULFILLMENT_STATUSES)[number];
