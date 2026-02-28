-- Create agent_restorations table (audit when super user restores a suspended agent)
CREATE TABLE public.agent_restorations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    restored_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    reason TEXT,
    restored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_restorations_agent_id ON public.agent_restorations(agent_id);
CREATE INDEX idx_agent_restorations_restored_at ON public.agent_restorations(restored_at);

COMMENT ON TABLE public.agent_restorations IS 'Log when a suspended agent was restored to active by a super user';
