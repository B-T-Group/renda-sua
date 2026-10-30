SET LOCAL lock_timeout = '5s';

-- Early dedicated-agent heads-up: once a scheduled order placed on dedicated
-- coverage is ready_for_pickup (dispatch gate still in the future), each
-- eligible dedicated agent for the slot gets one soft push ("you may get this
-- later"). Not a claimable offer. The primary key makes the push once per
-- order and agent; status 'unavailable' ("Can't take it") excludes the agent
-- from the dedicated fallback so dispatch goes to the open market.
-- Written by the backend only (no role permissions).
CREATE TABLE IF NOT EXISTS public.dedicated_order_heads_ups (
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  user_id uuid,
  assignment_id uuid REFERENCES public.dedicated_agent_assignments (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'unavailable')),
  reping_sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedicated_order_heads_ups_pkey PRIMARY KEY (order_id, agent_id)
);

CREATE INDEX IF NOT EXISTS dedicated_order_heads_ups_agent_idx
  ON public.dedicated_order_heads_ups (agent_id);

COMMENT ON TABLE public.dedicated_order_heads_ups IS
  'Soft heads-up push to a dedicated agent for a covered scheduled order (one per order and agent); unavailable = agent said they cannot take it.';

INSERT INTO public.message_types (id, comment) VALUES
  ('DEDICATED_ORDER_HEADS_UP', 'Heads-up to a dedicated agent: a scheduled order in their slot may come to them later')
ON CONFLICT (id) DO NOTHING;
