SET LOCAL lock_timeout = '5s';

-- #594 PR 6 (AC-A8): one row per agent, location, slot and date that got the
-- day-of slot reminder. Every order placed on the slot schedules its own
-- callback; the primary key makes the send idempotent per agent and slot, so
-- one failed schedule no longer drops the group's reminder and concurrent
-- callbacks still send once. Written by the backend only (no role permissions).
CREATE TABLE IF NOT EXISTS public.dedicated_slot_reminder_sends (
  business_location_id uuid NOT NULL REFERENCES public.business_locations (id) ON DELETE CASCADE,
  slot_key text NOT NULL,
  slot_date date NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.dedicated_agent_assignments (id) ON DELETE SET NULL,
  trigger_order_id uuid,
  order_count integer NOT NULL CHECK (order_count > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedicated_slot_reminder_sends_pkey PRIMARY KEY (business_location_id, slot_key, slot_date, agent_id)
);

COMMENT ON TABLE public.dedicated_slot_reminder_sends IS
  '#594 AC-A8: day-of dedicated slot reminder sent to an agent (idempotency key: location, slot, date, agent).';
