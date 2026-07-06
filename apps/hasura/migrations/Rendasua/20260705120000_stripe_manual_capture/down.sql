DROP INDEX IF EXISTS idx_orders_stripe_payment_intent_id;

ALTER TABLE public.orders
    DROP COLUMN IF EXISTS stripe_payment_intent_id,
    DROP COLUMN IF EXISTS payment_captured_at,
    DROP COLUMN IF EXISTS payment_authorized_at;

DROP INDEX IF EXISTS idx_stripe_payment_transactions_entity_status;

ALTER TABLE public.stripe_payment_transactions
    DROP CONSTRAINT IF EXISTS stripe_payment_transactions_capture_method_check;

ALTER TABLE public.stripe_payment_transactions
    DROP COLUMN IF EXISTS authorization_expires_at,
    DROP COLUMN IF EXISTS captured_at,
    DROP COLUMN IF EXISTS authorized_at,
    DROP COLUMN IF EXISTS capture_method;

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
