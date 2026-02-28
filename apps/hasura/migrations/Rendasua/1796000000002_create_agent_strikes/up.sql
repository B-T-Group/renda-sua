-- Create agent_strikes table (one row per strike event, e.g. pin_failed_3)
CREATE TABLE public.agent_strikes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    reason VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_strikes_agent_id ON public.agent_strikes(agent_id);
CREATE INDEX idx_agent_strikes_created_at ON public.agent_strikes(created_at);
CREATE INDEX idx_agent_strikes_agent_created ON public.agent_strikes(agent_id, created_at);

COMMENT ON TABLE public.agent_strikes IS 'Append-only log of agent strikes (e.g. pin_failed_3); suspension when 3 strikes in month';
