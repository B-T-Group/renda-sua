/** Order statuses that allow account deletion (no in-flight delivery). */
export const TERMINAL_ORDER_STATUSES = [
  'delivered',
  'complete',
  'cancelled',
  'failed',
  'refunded',
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_rejected',
  'refund_approved_replace',
] as const;

export const DELETED_USER_DISPLAY_NAME = 'Deleted User';
export const DELETED_BUSINESS_DISPLAY_NAME = 'Deleted Business';
