-- Postgres cannot drop enum values. Columns and proof photos can be removed.

DROP TABLE IF EXISTS public.order_delivery_proof_photos;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS delivery_confirmation_method,
  DROP COLUMN IF EXISTS client_confirmation_requested_at,
  DROP COLUMN IF EXISTS client_confirmed_at,
  DROP COLUMN IF EXISTS auto_complete_deadline_at,
  DROP COLUMN IF EXISTS delivery_proof_submitted_at,
  DROP COLUMN IF EXISTS awaiting_confirm_reminder_1h_at,
  DROP COLUMN IF EXISTS awaiting_confirm_reminder_24h_at,
  DROP COLUMN IF EXISTS awaiting_confirm_support_ticket_id;

DELETE FROM public.application_configurations
WHERE config_key IN (
  'client_confirm_auto_complete_hours',
  'client_confirm_grace_minutes',
  'client_confirm_nonstripe_support_hours',
  'client_confirm_gift_buyer_can_confirm'
);
