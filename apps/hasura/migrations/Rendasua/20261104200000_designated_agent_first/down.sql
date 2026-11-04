DELETE FROM public.message_types WHERE id IN
  ('DEDICATED_EARLY_OFFER', 'DEDICATED_OPEN_OFFER_REMINDER', 'DEDICATED_PICKUP_REMINDER', 'DEDICATED_UNCONFIRMED', 'DEDICATED_LATE_RELEASE');
DELETE FROM public.application_configurations WHERE config_key IN (
  'designated_first_enabled', 'dedicated_auto_assign_internal', 'designated_evening_before_enabled',
  'designated_unconfirmed_auto_release', 'designated_open_offer_reminder_minutes', 'designated_release_cutoff_minutes',
  'designated_reminder_minutes_before', 'designated_evening_before_local_minutes');
DROP TABLE IF EXISTS public.agent_reliability_events;
DROP INDEX IF EXISTS public.order_offers_designated_open_idx;
DROP INDEX IF EXISTS public.order_offers_early_expiry_idx;
ALTER TABLE public.order_offers DROP CONSTRAINT IF EXISTS order_offers_phase_check;
ALTER TABLE public.order_offers
  DROP COLUMN IF EXISTS phase,
  DROP COLUMN IF EXISTS reminder_sent_at,
  DROP COLUMN IF EXISTS payload;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_dispatch_mode_check;
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS dispatch_mode,
  DROP COLUMN IF EXISTS designated_accepted_at,
  DROP COLUMN IF EXISTS designated_release_cutoff_at,
  DROP COLUMN IF EXISTS designated_reminder_sent_at,
  DROP COLUMN IF EXISTS designated_evening_reminder_sent_at,
  DROP COLUMN IF EXISTS designated_confirmed_at,
  DROP COLUMN IF EXISTS designated_unconfirmed_flagged_at;
-- dedicated_claim_order: restore the 20261018200001 body (counts every active order).
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
BEGIN
  PERFORM 1 FROM public.agents WHERE id = p_agent_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Same statuses as DEDICATED_ACTIVE_ORDER_STATUSES (MID_FULFILLMENT_STATUSES).
  SELECT count(*) INTO v_load
    FROM public.orders o
   WHERE o.assigned_agent_id = p_agent_id
     AND o.id <> p_order_id
     AND o.current_status IN ('assigned_to_agent', 'picked_up', 'in_transit', 'out_for_delivery');

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
