-- Refund Management System v2: case extensions, payments, events, returns, Stripe linkage

-- Enums
CREATE TYPE refund_destination AS ENUM ('stripe', 'wallet', 'manual');
CREATE TYPE refund_payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'canceled');
CREATE TYPE refund_event_actor_type AS ENUM ('client', 'business', 'admin', 'system');
CREATE TYPE return_status AS ENUM (
    'not_required',
    'requested',
    'in_transit',
    'received',
    'inspected'
);
CREATE TYPE stripe_refund_type AS ENUM (
    'cancellation',
    'post_delivery_full',
    'post_delivery_partial',
    'force_admin'
);

-- Order status extensions for payment processing visibility
ALTER TYPE order_status ADD VALUE 'refund_processing' AFTER 'refund_rejected';
ALTER TYPE order_status ADD VALUE 'refund_failed' AFTER 'refund_processing';

-- Extend refund case (order_refund_requests)
ALTER TABLE public.order_refund_requests
    ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS requested_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3),
    ADD COLUMN IF NOT EXISTS payment_source_snapshot VARCHAR(50),
    ADD COLUMN IF NOT EXISTS destination refund_destination,
    ADD COLUMN IF NOT EXISTS return_required BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS return_status return_status NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS info_request_message TEXT,
    ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

COMMENT ON COLUMN public.order_refund_requests.destination IS 'Computed refund rail: stripe for card, wallet for mobile/cash/wallet pay';

-- Refund timeline events (append-only audit)
CREATE TABLE public.order_refund_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_request_id UUID NOT NULL REFERENCES public.order_refund_requests(id) ON DELETE CASCADE,
    event_type VARCHAR(80) NOT NULL,
    actor_type refund_event_actor_type NOT NULL DEFAULT 'system',
    actor_user_id UUID REFERENCES public.users(id),
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_refund_events_request_id ON public.order_refund_events(refund_request_id);
CREATE INDEX idx_order_refund_events_created_at ON public.order_refund_events(created_at);

-- Client/business evidence uploads
CREATE TABLE public.order_refund_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_request_id UUID NOT NULL REFERENCES public.order_refund_requests(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(100),
    uploaded_by_user_id UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_refund_evidence_request_id ON public.order_refund_evidence(refund_request_id);

-- Money movement attempts (one row per payout try)
CREATE TABLE public.order_refund_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_request_id UUID NOT NULL REFERENCES public.order_refund_requests(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    destination refund_destination NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    status refund_payment_status NOT NULL DEFAULT 'pending',
    provider_ref TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    failure_reason TEXT,
    attempt INTEGER NOT NULL DEFAULT 1,
    stripe_refund_id UUID REFERENCES public.stripe_refunds(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_refund_payments_request_id ON public.order_refund_payments(refund_request_id);
CREATE INDEX idx_order_refund_payments_order_id ON public.order_refund_payments(order_id);
CREATE INDEX idx_order_refund_payments_status ON public.order_refund_payments(status);

CREATE TRIGGER set_order_refund_payments_updated_at
    BEFORE UPDATE ON public.order_refund_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Physical return workflow
CREATE TABLE public.order_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_request_id UUID NOT NULL UNIQUE REFERENCES public.order_refund_requests(id) ON DELETE CASCADE,
    status return_status NOT NULL DEFAULT 'requested',
    instructions TEXT,
    received_at TIMESTAMPTZ,
    inspected_at TIMESTAMPTZ,
    inspection_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_order_returns_updated_at
    BEFORE UPDATE ON public.order_returns
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Extend stripe_refunds for post-delivery linkage
ALTER TABLE public.stripe_refunds
    ADD COLUMN IF NOT EXISTS refund_request_id UUID REFERENCES public.order_refund_requests(id),
    ADD COLUMN IF NOT EXISTS refund_payment_id UUID REFERENCES public.order_refund_payments(id),
    ADD COLUMN IF NOT EXISTS refund_type stripe_refund_type;

ALTER TABLE public.stripe_refunds
    ALTER COLUMN cancellation_fee DROP NOT NULL,
    ALTER COLUMN cancelled_by DROP NOT NULL;

COMMENT ON COLUMN public.orders.payment_status IS 'Includes paid, authorized, refunded, partially_refunded for reporting';
