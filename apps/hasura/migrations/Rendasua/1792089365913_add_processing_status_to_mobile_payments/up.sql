-- Add 'processing' status to mobile_payment_transactions status check constraint
ALTER TABLE public.mobile_payment_transactions
DROP CONSTRAINT IF EXISTS mobile_payment_transactions_status_check;

ALTER TABLE public.mobile_payment_transactions
ADD CONSTRAINT mobile_payment_transactions_status_check
CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled'));
