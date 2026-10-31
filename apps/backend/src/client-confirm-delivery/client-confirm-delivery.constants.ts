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
