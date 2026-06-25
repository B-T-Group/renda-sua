-- Migration: create_stripe_tables
-- Description: Stripe Connect accounts (owner-level), Stripe payment transactions
--              (client hosted-checkout ledger), and a Stripe webhook event log
--              used for idempotent event processing.

-- 1. stripe_connect_accounts: one Connect (Express) account per platform user.
--    Anchored at users.id and shared across all of that user's business_locations.
CREATE TABLE public.stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    stripe_account_id TEXT NOT NULL UNIQUE,
    account_type TEXT NOT NULL DEFAULT 'express',
    country CHAR(2),
    default_currency VARCHAR(3),
    charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    disabled_reason TEXT,
    requirements JSONB,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'restricted', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_stripe_connect_accounts_user
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON UPDATE RESTRICT ON DELETE CASCADE
);

CREATE INDEX idx_stripe_connect_accounts_user_id
    ON public.stripe_connect_accounts(user_id);
CREATE INDEX idx_stripe_connect_accounts_stripe_account_id
    ON public.stripe_connect_accounts(stripe_account_id);
CREATE INDEX idx_stripe_connect_accounts_status
    ON public.stripe_connect_accounts(status);

CREATE TRIGGER set_public_stripe_connect_accounts_updated_at
    BEFORE UPDATE ON public.stripe_connect_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 2. stripe_payment_transactions: mirrors mobile_payment_transactions for the
--    Stripe rail (hosted Checkout). Funds credit the internal wallet on success.
CREATE TABLE public.stripe_payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(255) NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'PAYMENT'
        CHECK (transaction_type IN ('PAYMENT', 'GIVE_CHANGE')),
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    payment_url TEXT,
    account_id UUID,
    payment_entity TEXT,
    entity_id TEXT,
    customer_email VARCHAR(255),
    success_url TEXT,
    cancel_url TEXT,
    error_message TEXT,
    error_code VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_stripe_payment_transactions_account
        FOREIGN KEY (account_id) REFERENCES public.accounts(id)
        ON UPDATE RESTRICT ON DELETE SET NULL
);

CREATE INDEX idx_stripe_payment_transactions_reference
    ON public.stripe_payment_transactions(reference);
CREATE INDEX idx_stripe_payment_transactions_status
    ON public.stripe_payment_transactions(status);
CREATE INDEX idx_stripe_payment_transactions_session
    ON public.stripe_payment_transactions(stripe_session_id);
CREATE INDEX idx_stripe_payment_transactions_payment_intent
    ON public.stripe_payment_transactions(stripe_payment_intent_id);
CREATE INDEX idx_stripe_payment_transactions_account_id
    ON public.stripe_payment_transactions(account_id);
CREATE INDEX idx_stripe_payment_transactions_created_at
    ON public.stripe_payment_transactions(created_at);

CREATE TRIGGER set_public_stripe_payment_transactions_updated_at
    BEFORE UPDATE ON public.stripe_payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 3. stripe_events: dedup log for incoming webhook events (idempotency).
CREATE TABLE public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'payments'
        CHECK (source IN ('payments', 'connect')),
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_stripe_events_event_type ON public.stripe_events(event_type);
CREATE INDEX idx_stripe_events_created_at ON public.stripe_events(created_at);
