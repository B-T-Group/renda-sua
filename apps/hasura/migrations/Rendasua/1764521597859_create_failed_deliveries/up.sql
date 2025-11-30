-- Create failed_delivery_status enum
CREATE TYPE public.failed_delivery_status_enum AS ENUM (
    'pending',    -- Failed delivery awaiting resolution
    'completed'   -- Failed delivery has been resolved
);

-- Create failed_delivery_resolution_type enum
CREATE TYPE public.failed_delivery_resolution_type_enum AS ENUM (
    'agent_fault',  -- Agent is at fault
    'client_fault', -- Client is at fault
    'item_fault'    -- Item issue is at fault
);

-- Create failed_deliveries table
CREATE TABLE public.failed_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    failure_reason_id UUID NOT NULL REFERENCES public.delivery_failure_reasons(id) ON DELETE RESTRICT,
    notes TEXT,
    status public.failed_delivery_status_enum NOT NULL DEFAULT 'pending',
    resolution_type public.failed_delivery_resolution_type_enum,
    outcome TEXT,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_failed_deliveries_order_id ON public.failed_deliveries(order_id);
CREATE INDEX idx_failed_deliveries_status ON public.failed_deliveries(status);
CREATE INDEX idx_failed_deliveries_failure_reason_id ON public.failed_deliveries(failure_reason_id);
CREATE INDEX idx_failed_deliveries_resolved_by ON public.failed_deliveries(resolved_by);
CREATE INDEX idx_failed_deliveries_resolution_type ON public.failed_deliveries(resolution_type);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_failed_deliveries_updated_at
    BEFORE UPDATE ON public.failed_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comments
COMMENT ON TABLE public.failed_deliveries IS 'Tracks failed deliveries and their resolution status';
COMMENT ON COLUMN public.failed_deliveries.order_id IS 'Reference to the order that failed delivery';
COMMENT ON COLUMN public.failed_deliveries.failure_reason_id IS 'Reason why the delivery failed';
COMMENT ON COLUMN public.failed_deliveries.notes IS 'Optional notes about the failure';
COMMENT ON COLUMN public.failed_deliveries.status IS 'Current status of the failed delivery (pending or completed)';
COMMENT ON COLUMN public.failed_deliveries.resolution_type IS 'Type of resolution applied (agent_fault, client_fault, item_fault)';
COMMENT ON COLUMN public.failed_deliveries.outcome IS 'Free-form description of how the failure was resolved';
COMMENT ON COLUMN public.failed_deliveries.resolved_by IS 'User who resolved the failed delivery';
COMMENT ON COLUMN public.failed_deliveries.resolved_at IS 'Timestamp when the failed delivery was resolved';

