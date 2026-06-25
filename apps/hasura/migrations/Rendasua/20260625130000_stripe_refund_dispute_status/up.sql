-- Allow refunded/disputed states on Stripe payment transactions so the
-- payments webhook can record charge.refunded and charge.dispute.created.
ALTER TABLE public.stripe_payment_transactions
    DROP CONSTRAINT IF EXISTS stripe_payment_transactions_status_check;

ALTER TABLE public.stripe_payment_transactions
    ADD CONSTRAINT stripe_payment_transactions_status_check
    CHECK (
        status IN (
            'pending',
            'success',
            'failed',
            'cancelled',
            'refunded',
            'disputed'
        )
    );
