-- #594 PR 7: dedicated-agent postings (AC-B11..B16, A1..A4, E8). Behind dedicated_agents_enabled.
-- Tables come from 20261018180000_dedicated_agents_schema. This adds the notice types and the
-- accept function. Reference rows are safe to re-run; the function is CREATE OR REPLACE.
SET LOCAL lock_timeout = '5s';

INSERT INTO public.entity_types (id, comment) VALUES
  ('dedicated_agent_posting', 'Dedicated delivery agent posting related messages')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_types (id, comment) VALUES
  ('DEDICATED_POSTING_NEW_APPLICATION', 'An agent applied to a dedicated agent posting (to the business)'),
  ('DEDICATED_POSTING_ACCEPTED', 'The business accepted the agent on a dedicated agent posting'),
  ('DEDICATED_POSTING_FILLED', 'A dedicated agent posting was filled and the pending application auto-declined'),
  ('DEDICATED_POSTING_CLOSED', 'A dedicated agent posting was closed or expired and the pending application auto-declined'),
  ('DEDICATED_POSTING_TERMS_UPDATED', 'The business updated the terms of a dedicated agent posting the agent applied to')
ON CONFLICT (id) DO NOTHING;

-- AC-E8: accept, the count check and the auto-decline in ONE transaction (the function call).
-- Lock order: the posting row FOR UPDATE first (every accept / close / expiry of a posting queues
-- on it), then the application. The assignment insert then takes the agent lock in the cap trigger
-- (FOR NO KEY UPDATE), so two accepts of the same agent on different postings serialise there.
-- Under READ COMMITTED (Hasura) each statement below sees rows committed by the accept we waited on.
-- A refusal changes nothing and returns the application as it is now (status <> 'accepted'); the
-- backend reads the reason back. Returns the accepted row plus every row auto-declined by this call.
CREATE OR REPLACE FUNCTION public.dedicated_accept_application(
  p_application_id uuid,
  p_actor_user_id uuid
)
RETURNS SETOF public.dedicated_agent_applications
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_posting_id uuid;
  post public.dedicated_agent_postings%ROWTYPE;
  app public.dedicated_agent_applications%ROWTYPE;
  ag public.agents%ROWTYPE;
  v_contract_required boolean;
  v_now timestamptz := now();
BEGIN
  SELECT a.posting_id INTO v_posting_id
    FROM public.dedicated_agent_applications a
   WHERE a.id = p_application_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO post FROM public.dedicated_agent_postings WHERE id = v_posting_id FOR UPDATE;
  SELECT * INTO app FROM public.dedicated_agent_applications WHERE id = p_application_id FOR UPDATE;

  IF post.status <> 'open'
     OR post.expires_at <= v_now
     OR app.status <> 'applied'
     OR post.accepted_count >= post.headcount
     OR EXISTS (
       SELECT 1
         FROM public.dedicated_agent_assignments x
         JOIN public.dedicated_agent_posting_slots s
           ON s.posting_id = post.id AND s.slot_key = x.slot_key
        WHERE x.agent_id = app.agent_id
          AND x.business_location_id = post.business_location_id
          AND x.status IN ('active', 'paused')
     ) THEN
    RETURN QUERY SELECT * FROM public.dedicated_agent_applications WHERE id = p_application_id;
    RETURN;
  END IF;

  -- QA #613 N2: a slot the business switched off since posting (AC-B4) is refused.
  -- The settings rows are locked FOR SHARE so a concurrent toggle (whose predicate
  -- pause then sees these assignments) waits for this accept.
  PERFORM 1
     FROM public.business_location_pickup_slots b
     JOIN public.dedicated_agent_posting_slots s ON s.slot_key = b.slot_key AND s.posting_id = post.id
    WHERE b.business_location_id = post.business_location_id
      FOR SHARE OF b;
  IF EXISTS (
    SELECT 1
      FROM public.business_location_pickup_slots b
      JOIN public.dedicated_agent_posting_slots s ON s.slot_key = b.slot_key AND s.posting_id = post.id
     WHERE b.business_location_id = post.business_location_id
       AND b.is_enabled = false
  ) THEN
    RAISE EXCEPTION 'dedicated_accept_slot_disabled: posting % has a slot the store turned off', post.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- QA #613 N3: the applicant must still be verified, not suspended and under contract.
  -- Agent row lock (FOR NO KEY UPDATE, the cap trigger's lock): a concurrent suspension
  -- (UPDATE agents) is serialised with this check.
  SELECT * INTO ag FROM public.agents WHERE id = app.agent_id FOR NO KEY UPDATE;
  IF NOT FOUND OR ag.is_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'dedicated_accept_agent_ineligible: not_verified' USING ERRCODE = 'check_violation';
  END IF;
  IF ag.status = 'suspended' THEN
    RAISE EXCEPTION 'dedicated_accept_agent_ineligible: suspended' USING ERRCODE = 'check_violation';
  END IF;
  -- Same rule as AgentContractGateService: required unless the global flag is set false.
  SELECT COALESCE((
    SELECT c.boolean_value
      FROM public.application_configurations c
     WHERE c.config_key = 'agent_contract_required'
       AND c.status = 'active'
       AND c.country_code IS NULL
     LIMIT 1
  ), true) INTO v_contract_required;
  IF v_contract_required AND NOT EXISTS (
    SELECT 1 FROM public.agent_contracts k WHERE k.agent_id = ag.id AND k.status = 'signed'
  ) THEN
    RAISE EXCEPTION 'dedicated_accept_agent_ineligible: contract_unsigned' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.dedicated_agent_assignments (
    business_location_id, agent_id, slot_key, status, source, posting_id, application_id, assigned_by_user_id
  )
  SELECT post.business_location_id, app.agent_id, s.slot_key, 'active', 'posting', post.id, app.id, p_actor_user_id
    FROM public.dedicated_agent_posting_slots s
   WHERE s.posting_id = post.id
   ORDER BY s.slot_key;

  UPDATE public.dedicated_agent_applications
     SET status = 'accepted', decided_by_user_id = p_actor_user_id, decided_at = v_now
   WHERE id = app.id;

  UPDATE public.dedicated_agent_postings
     SET accepted_count = accepted_count + 1,
         status = CASE WHEN accepted_count + 1 >= headcount THEN 'filled' ELSE status END,
         filled_at = CASE WHEN accepted_count + 1 >= headcount THEN v_now ELSE filled_at END
   WHERE id = post.id;

  IF post.accepted_count + 1 >= post.headcount THEN
    RETURN QUERY
      UPDATE public.dedicated_agent_applications
         SET status = 'auto_declined', decided_at = v_now
       WHERE posting_id = post.id AND status = 'applied'
      RETURNING *;
  END IF;

  RETURN QUERY SELECT * FROM public.dedicated_agent_applications WHERE id = app.id;
END;
$$;

COMMENT ON FUNCTION public.dedicated_accept_application(uuid, uuid) IS
  '#594 AC-E8: accept a dedicated posting application, check the count, auto-decline the rest when filled; one transaction';
