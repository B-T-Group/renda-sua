export const AWAITING_CLIENT_CONFIRMATION = 'awaiting_client_confirmation';
export const PENDING_AUTO_COMPLETE = 'pending_auto_complete';
export const DISPUTED = 'disputed';

export const CLIENT_CONFIRM_ACTIVE_STATUSES = [
  AWAITING_CLIENT_CONFIRMATION,
  PENDING_AUTO_COMPLETE,
] as const;

export const CLIENT_CONFIRM_COMPLETABLE_FROM = [
  'out_for_delivery',
  AWAITING_CLIENT_CONFIRMATION,
  PENDING_AUTO_COMPLETE,
] as const;

export const OVERWRITE_ALLOWED_STATUSES = [
  'out_for_delivery',
  AWAITING_CLIENT_CONFIRMATION,
  PENDING_AUTO_COMPLETE,
] as const;

export const DEFAULT_AUTO_COMPLETE_HOURS = 2;
export const DEFAULT_GRACE_MINUTES = 5;
export const DEFAULT_NONSTRIPE_SUPPORT_HOURS = 48;
export const NONSTRIPE_REMINDER_1H_HOURS = 1;
export const NONSTRIPE_REMINDER_24H_HOURS = 24;

export const CONFIG_AUTO_COMPLETE_HOURS = 'client_confirm_auto_complete_hours';
export const CONFIG_GRACE_MINUTES = 'client_confirm_grace_minutes';
export const CONFIG_NONSTRIPE_SUPPORT_HOURS =
  'client_confirm_nonstripe_support_hours';
/** OQ1 unlocked: default ON. Flip this config to false to restrict confirm to the recipient. */
export const CONFIG_GIFT_BUYER_CAN_CONFIRM =
  'client_confirm_gift_buyer_can_confirm';

export const RECIPIENT_CONFIRM_NOTIFICATION_TYPE =
  'order.recipient.confirm_delivery';

export type DeliveryConfirmationMethod =
  | 'client'
  | 'recipient'
  | 'buyer'
  | 'auto_complete'
  | 'overwrite'
  | 'pin';

/** MoMo (non-Stripe) "Delivered → client Complete" rules. */
export const DEFAULT_MOMO_AUTO_COMPLETE_HOURS = 2;
export const DEFAULT_MOMO_REMINDER_HOURS = 1;
export const DEFAULT_REPORT_WINDOW_HOURS = 24;
export const DEFAULT_CLIENT_FLAG_THRESHOLD = 2;
export const DEFAULT_CLIENT_FLAG_WINDOW_DAYS = 90;

export const CONFIG_MOMO_AUTO_COMPLETE_HOURS = 'client_confirm_momo_auto_complete_hours';
export const CONFIG_MOMO_REMINDER_HOURS = 'client_confirm_momo_reminder_hours';
export const CONFIG_REPORT_WINDOW_HOURS = 'client_confirm_report_window_hours';
export const CONFIG_CLIENT_FLAG_THRESHOLD = 'client_report_flag_threshold';
export const CONFIG_CLIENT_FLAG_WINDOW_DAYS = 'client_report_flag_window_days';

export const DELIVERY_REPORT_TYPES = ['issue', 'delivery_failed'] as const;
export type DeliveryReportType = (typeof DELIVERY_REPORT_TYPES)[number];

export const ISSUE_REASONS = [
  'missing_items',
  'wrong_items',
  'damaged',
  'other',
] as const;
/** courier_didnt_come covers an early "Delivered" tap: pauses auto-complete, goes to support. */
export const DELIVERY_FAILED_REASONS = [
  'courier_didnt_come',
  'not_received',
  'other',
] as const;

export const DELIVERY_REPORT_OUTCOMES = [
  'pending',
  'supported',
  'unsupported',
  'partial',
] as const;
export type DeliveryReportOutcome = (typeof DELIVERY_REPORT_OUTCOMES)[number];
