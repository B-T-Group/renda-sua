-- #594 QA #607 N1: the dedicated claim (cap count + assign) in ONE statement-level
-- transaction. The agent row is locked FOR NO KEY UPDATE first, the same lock (and
-- lock order: agent rows, by agent_id) the assignment cap trigger takes, so two
-- dedicated claims for one agent serialise here and the second one counts the first
-- one's order. Under READ COMMITTED the count runs after the lock wait, so it sees
-- the order the other claim committed.
--   p_count_offers: auto-assign counts the agent's other live dedicated offers;
--   an offer accept does not (QA #607 N4: other offers must not block an accept).
-- Over the cap -> raises dedicated_order_cap_exceeded (nothing written). Order no
-- longer claimable -> returns no row (the caller's ALREADY_ASSIGNED).
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

COMMENT ON FUNCTION public.dedicated_claim_order(uuid, uuid, text, text, uuid, timestamptz, integer, boolean) IS
  '#594 QA #607 N1: dedicated claim with the per-agent order cap under the agent row lock; one transaction';
