-- Designated agent first (not a backup): the designated agent gets a claimable offer as soon as the
-- order is ready, even days ahead; nearby agents still wait for the dispatch gate (window - lead).
-- Additive and dark: everything is behind designated_first_enabled (global default false; DEV turns
-- it on per country). In-flight orders keep today's path (orders.dispatch_mode stays NULL).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispatch_mode TEXT,
  ADD COLUMN IF NOT EXISTS designated_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS designated_release_cutoff_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS designated_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS designated_evening_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS designated_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS designated_unconfirmed_flagged_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_dispatch_mode_check
    CHECK (dispatch_mode IS NULL OR dispatch_mode IN ('designated_first', 'fallback')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.orders.dispatch_mode IS
  'Stamped at ready: designated_first = designated agents were offered the order at ready; fallback/NULL = legacy dedicated fallback at the gate.';
COMMENT ON COLUMN public.orders.designated_release_cutoff_at IS
  'Window start - designated_release_cutoff_minutes, stamped at accept. Release before it is free; after it is a strike plus immediate open dispatch.';
COMMENT ON COLUMN public.orders.designated_confirmed_at IS
  'The designated agent tapped "Still on it" (or accepted inside the reminder lead).';

ALTER TABLE public.order_offers
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'gate',
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payload JSONB;

DO $$ BEGIN
  ALTER TABLE public.order_offers ADD CONSTRAINT order_offers_phase_check
    CHECK (phase IN ('early', 'gate')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.order_offers.phase IS
  'early = designated offer sent at ready (expires at the gate); gate = any offer sent at or after dispatch_ready_at.';
COMMENT ON COLUMN public.order_offers.payload IS
  'Snapshot at send for audit/dispute: distances, distance origin, commission, window.';

-- One live early designated offer per (order, agent) is already guaranteed by order_offers_order_agent_unique.
CREATE INDEX IF NOT EXISTS order_offers_designated_open_idx
  ON public.order_offers (agent_id, status)
  WHERE offer_kind = 'dedicated' AND status = 'offered';
CREATE INDEX IF NOT EXISTS order_offers_early_expiry_idx
  ON public.order_offers (expires_at)
  WHERE phase = 'early' AND status = 'offered';

CREATE TABLE IF NOT EXISTS public.agent_reliability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('late_release', 'reminder_unconfirmed', 'no_show')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_reliability_events_agent_idx
  ON public.agent_reliability_events (agent_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS agent_reliability_events_once_idx
  ON public.agent_reliability_events (agent_id, order_id, kind);
COMMENT ON TABLE public.agent_reliability_events IS
  'Audit of designated-agent reliability signals (late release, unconfirmed reminder). Written by the backend only.';

-- Capacity for designated-first orders counts per slot day (Samuel, Nov 4 2026): an agent holding
-- future orders on other days is not at the cap. Other orders keep counting every active order.
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.dedicated_claim_order(
  p_order_id uuid,
  p_agent_id uuid,
  p_status text,
  p_assignment_source text,
  p_dedicated_assignment_id uuid,
  p_release_until timestamptz,
  p_max_active integer,
  p_count_offers boolean
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_load integer;
  v_mode text;
  v_day date;
BEGIN
  PERFORM 1 FROM public.agents WHERE id = p_agent_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT o.dispatch_mode,
         (SELECT w.preferred_date FROM public.delivery_time_windows w
           WHERE w.order_id = o.id ORDER BY w.created_at DESC LIMIT 1)
    INTO v_mode, v_day
    FROM public.orders o WHERE o.id = p_order_id;

  -- Same statuses as DEDICATED_ACTIVE_ORDER_STATUSES (MID_FULFILLMENT_STATUSES).
  SELECT count(*) INTO v_load
    FROM public.orders o
   WHERE o.assigned_agent_id = p_agent_id
     AND o.id <> p_order_id
     AND o.current_status IN ('assigned_to_agent', 'picked_up', 'in_transit', 'out_for_delivery')
     AND (
       v_mode IS DISTINCT FROM 'designated_first' OR v_day IS NULL
       OR o.current_status <> 'assigned_to_agent'
       OR COALESCE((SELECT w.preferred_date FROM public.delivery_time_windows w
                     WHERE w.order_id = o.id ORDER BY w.created_at DESC LIMIT 1), v_day) = v_day
     );

  IF p_count_offers THEN
    v_load := v_load + (
      SELECT count(*)
        FROM public.order_offers f
       WHERE f.agent_id = p_agent_id
         AND f.offer_kind = 'dedicated'
         AND f.status = 'offered'
         AND f.expires_at > now()
         AND f.order_id <> p_order_id
    );
  END IF;

  IF v_load >= p_max_active THEN
    RAISE EXCEPTION 'dedicated_order_cap_exceeded: agent % has % of % active dedicated orders',
      p_agent_id, v_load, p_max_active
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY
    UPDATE public.orders
       SET current_status = p_status::public.order_status,
           assigned_agent_id = p_agent_id,
           assigned_at = now(),
           updated_at = now(),
           assignment_source = p_assignment_source,
           dedicated_assignment_id = p_dedicated_assignment_id,
           dedicated_release_until = p_release_until
     WHERE id = p_order_id
       AND current_status = 'ready_for_pickup'
       AND assigned_agent_id IS NULL
    RETURNING *;
END;
$$;

INSERT INTO public.application_configurations
  (config_key, config_name, description, data_type, boolean_value, number_value, min_value, max_value,
   country_code, tags, status, version)
SELECT v.k, v.n, v.d, v.t, v.b, v.num, v.mn, v.mx, NULL, ARRAY['dedicated-agents', 'designated-first']::text[], 'active', 1
FROM (VALUES
  ('designated_first_enabled', 'Designated agent first enabled',
   'Designated agents get a claimable offer as soon as an order is ready (even days ahead); nearby agents still wait for the dispatch gate. Default false; set per country.',
   'boolean', false, NULL::numeric, NULL::numeric, NULL::numeric),
  ('dedicated_auto_assign_internal', 'Auto-assign the only internal designated agent',
   'When exactly one internal designated agent is eligible, assign at ready (with a free Release) instead of offering. Default true.',
   'boolean', true, NULL, NULL, NULL),
  ('designated_evening_before_enabled', 'Designated evening-before reminder',
   'Send the designated agent a reminder the evening before a next-day order. Default true.',
   'boolean', true, NULL, NULL, NULL),
  ('designated_unconfirmed_auto_release', 'Auto-release an unconfirmed designated agent at the gate',
   'false (default) = flag to admin and business only; true = release under the back-out rules.',
   'boolean', false, NULL, NULL, NULL),
  ('designated_open_offer_reminder_minutes', 'Open designated offer reminder (minutes before gate)',
   'Minutes before the dispatch gate to re-ping a designated agent whose offer is still open. 0 = off. Default 12.',
   'number', NULL, 12, 0, 120),
  ('designated_release_cutoff_minutes', 'Designated free release cutoff (minutes before window)',
   'A designated agent may release an accepted order for free until window start minus this. After it: strike + immediate open dispatch. Default 120.',
   'number', NULL, 120, 0, 1440),
  ('designated_reminder_minutes_before', 'Designated pre-pickup reminder (minutes before window)',
   '"Still on it?" reminder this many minutes before the window start. Default 60.',
   'number', NULL, 60, 5, 720),
  ('designated_evening_before_local_minutes', 'Designated evening-before reminder time (minutes after local midnight)',
   'Local store time of the evening-before reminder, in minutes after midnight. Default 1140 (19:00).',
   'number', NULL, 1140, 0, 1439)
) AS v(k, n, d, t, b, num, mn, mx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations c WHERE c.config_key = v.k AND c.country_code IS NULL
);

INSERT INTO public.message_types (id, comment) VALUES
  ('DEDICATED_EARLY_OFFER', 'Designated agent: claimable offer at ready (accept before the gate)'),
  ('DEDICATED_OPEN_OFFER_REMINDER', 'Designated agent: open offer reminder before it is released to others'),
  ('DEDICATED_PICKUP_REMINDER', 'Designated agent: pre-pickup "still on it?" reminder'),
  ('DEDICATED_UNCONFIRMED', 'Business/admin: the designated agent did not confirm before the gate'),
  ('DEDICATED_LATE_RELEASE', 'Business/admin: the designated agent released after the free cutoff')
ON CONFLICT (id) DO NOTHING;
