-- Create order_offer_status enum
CREATE TYPE order_offer_status AS ENUM (
    'offered',
    'accepted',
    'declined',
    'expired',
    'cancelled'
);

-- Create order_offers table
-- Tracks high-priority delivery offers pushed to the closest eligible agents
-- when an order becomes claimable. The first agent to accept wins (atomic
-- assignment); sibling offers are cancelled. Offers expire after a short TTL.
CREATE TABLE public.order_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status order_offer_status NOT NULL DEFAULT 'offered',
    distance_km DECIMAL(10, 3),
    estimated_earnings DECIMAL(12, 2),
    currency VARCHAR(3),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Only one offer per agent per order
    CONSTRAINT order_offers_order_agent_unique UNIQUE (order_id, agent_id)
);

-- Indexes for efficient querying
CREATE INDEX idx_order_offers_order_id ON public.order_offers(order_id);
CREATE INDEX idx_order_offers_agent_id ON public.order_offers(agent_id);
CREATE INDEX idx_order_offers_user_id ON public.order_offers(user_id);
CREATE INDEX idx_order_offers_status ON public.order_offers(status);
CREATE INDEX idx_order_offers_expires_at ON public.order_offers(expires_at);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_order_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_offers_updated_at
    BEFORE UPDATE ON public.order_offers
    FOR EACH ROW
    EXECUTE FUNCTION update_order_offers_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.order_offers IS
'Delivery offers pushed to the closest eligible agents when an order becomes claimable. First agent to accept wins via atomic assignment.';
COMMENT ON COLUMN public.order_offers.status IS
'Offer lifecycle: offered (push sent), accepted (agent won the claim), declined (agent declined), expired (TTL elapsed without response), cancelled (another agent accepted).';
COMMENT ON COLUMN public.order_offers.distance_km IS
'Distance in km from the agent''s last known location to the pickup location at offer time.';
COMMENT ON COLUMN public.order_offers.estimated_earnings IS
'Estimated agent earnings (commission) for this delivery at offer time.';
COMMENT ON COLUMN public.order_offers.expires_at IS
'Timestamp after which the offer is no longer acceptable.';
