-- Convert any processing rows to pending first
UPDATE public.mobile_payment_transactions
SET status = 'pending'
WHERE status = 'processing';

-- Revert to original status check constraint
ALTER TABLE public.mobile_payment_transactions
DROP CONSTRAINT IF EXISTS mobile_payment_transactions_status_check;

ALTER TABLE public.mobile_payment_transactions
ADD CONSTRAINT mobile_payment_transactions_status_check
CHECK (status IN ('pending', 'success', 'failed', 'cancelled'));
