-- Add fields to track payment failure timing/message for grace-period cancellation.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_failure_message text NULL;

COMMENT ON COLUMN public.orders.payment_failed_at IS
  'Timestamp of the most recent payment failure for this order (used for grace-period auto-cancel).';
COMMENT ON COLUMN public.orders.payment_failure_message IS
  'Most recent payment failure message (provider or system) for client/agent notification.';

