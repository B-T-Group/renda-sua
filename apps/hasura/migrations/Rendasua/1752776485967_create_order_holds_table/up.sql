-- Create order_hold_status enum
CREATE TYPE public.order_hold_status_enum AS ENUM (
    'active',     -- Hold is currently active
    'cancelled',  -- Hold was cancelled
    'completed'   -- Hold was completed (order delivered/paid)
);

-- Create order_holds table
CREATE TABLE public.order_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    client_hold_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    agent_hold_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    currency currency_enum NOT NULL,
    status order_hold_status_enum NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT order_holds_amounts_check CHECK (client_hold_amount >= 0 AND agent_hold_amount >= 0),
    CONSTRAINT order_holds_unique_order UNIQUE (order_id)
);

-- Create indexes for better performance
CREATE INDEX idx_order_holds_order_id ON public.order_holds(order_id);
CREATE INDEX idx_order_holds_client_id ON public.order_holds(client_id);
CREATE INDEX idx_order_holds_agent_id ON public.order_holds(agent_id);
CREATE INDEX idx_order_holds_status ON public.order_holds(status);
CREATE INDEX idx_order_holds_created_at ON public.order_holds(created_at);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_order_holds_updated_at
    BEFORE UPDATE ON public.order_holds
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comments
COMMENT ON TABLE public.order_holds IS 'Tracks holds placed on client and agent accounts for orders';
COMMENT ON COLUMN public.order_holds.client_hold_amount IS 'Amount held from client account for the order';
COMMENT ON COLUMN public.order_holds.agent_hold_amount IS 'Amount held from agent account for the order';
COMMENT ON COLUMN public.order_holds.status IS 'Current status of the hold (active, cancelled, completed)';
