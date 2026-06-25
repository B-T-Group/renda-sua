ALTER TABLE public.stripe_payment_transactions
    DROP CONSTRAINT IF EXISTS stripe_payment_transactions_status_check;

ALTER TABLE public.stripe_payment_transactions
    ADD CONSTRAINT stripe_payment_transactions_status_check
    CHECK (status IN ('pending', 'success', 'failed', 'cancelled'));
