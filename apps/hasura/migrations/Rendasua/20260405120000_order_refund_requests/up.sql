-- Refund policy: enums, order_refund_requests table, order_status extensions, orders.completed_at

-- 1) Reason enum for client dropdown
CREATE TYPE refund_request_reason AS ENUM (
    'not_delivered',
    'wrong_item',
    'damaged',
    'quality_issue',
    'missing_parts',
    'other'
);

-- 2) Lifecycle of a refund request row
CREATE TYPE refund_request_status AS ENUM (
    'pending',
    'approved_full',
    'approved_partial',
    'rejected',
    'completed'
);

-- 3) Extend order_status (after 'complete' per existing enum order)
ALTER TYPE order_status ADD VALUE 'refund_requested' AFTER 'complete';
ALTER TYPE order_status ADD VALUE 'refund_approved_full' AFTER 'refund_requested';
ALTER TYPE order_status ADD VALUE 'refund_approved_partial' AFTER 'refund_approved_full';
ALTER TYPE order_status ADD VALUE 'refund_rejected' AFTER 'refund_approved_partial';

-- 4) Completion time for 3-day return window
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.completed_at IS 'When the order reached completed delivery (complete status); used for return policy window.';

-- Backfill from order_status_history (latest transition to complete)
UPDATE public.orders o
SET completed_at = sub.max_at
FROM (
    SELECT order_id, MAX(created_at) AS max_at
    FROM public.order_status_history
    WHERE status = 'complete'
    GROUP BY order_id
) sub
WHERE o.id = sub.order_id
  AND o.completed_at IS NULL
  AND o.current_status = 'complete';

-- Fallback: use updated_at for complete orders missing history
UPDATE public.orders
SET completed_at = updated_at
WHERE current_status = 'complete'
  AND completed_at IS NULL;

-- 5) Refund requests table
CREATE TABLE public.order_refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    reason refund_request_reason NOT NULL,
    client_notes TEXT,
    status refund_request_status NOT NULL DEFAULT 'pending',
    business_note TEXT,
    rejection_reason TEXT,
    refund_item_amount NUMERIC(12, 2),
    refund_delivery_fee BOOLEAN,
    inspection_acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT order_refund_requests_refund_item_amount_check
        CHECK (refund_item_amount IS NULL OR refund_item_amount >= 0)
);

CREATE INDEX idx_order_refund_requests_order_id ON public.order_refund_requests(order_id);
CREATE INDEX idx_order_refund_requests_business_id ON public.order_refund_requests(business_id);
CREATE INDEX idx_order_refund_requests_client_id ON public.order_refund_requests(client_id);
CREATE INDEX idx_order_refund_requests_status ON public.order_refund_requests(status);

-- At most one open (pending) request per order
CREATE UNIQUE INDEX idx_order_refund_requests_one_pending
    ON public.order_refund_requests(order_id)
    WHERE status = 'pending';

CREATE TRIGGER set_order_refund_requests_updated_at
    BEFORE UPDATE ON public.order_refund_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TABLE public.order_refund_requests IS 'Client-initiated refund/return requests and business resolution.';
