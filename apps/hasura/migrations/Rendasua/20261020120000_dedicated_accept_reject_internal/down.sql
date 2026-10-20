-- #594 G2 rollback: restore the 20261018220000 accept function (internal agents accepted).
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
  v_location_id uuid;
  post public.dedicated_agent_postings%ROWTYPE;
  app public.dedicated_agent_applications%ROWTYPE;
  ag public.agents%ROWTYPE;
  v_contract_required boolean;
  v_now timestamptz := now();
BEGIN
  SELECT a.posting_id, p.business_location_id INTO v_posting_id, v_location_id
    FROM public.dedicated_agent_applications a
    JOIN public.dedicated_agent_postings p ON p.id = a.posting_id
   WHERE a.id = p_application_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Residual slot race: the store's business_locations row is locked FIRST, like the
  -- slot toggle and the super-user assign (no-op update_business_locations_by_pk in
  -- their Hasura mutations). A toggle then either commits before this check (and the
  -- accept refuses below) or waits for this accept (and its predicate pause sees the
  -- new assignments). FOR NO KEY UPDATE, not FOR UPDATE: inserts into child tables
  -- take FOR KEY SHARE on the location for their FK check.
  -- Lock order (all #594 writers): business_locations -> posting -> application -> agents.
  PERFORM 1 FROM public.business_locations WHERE id = v_location_id FOR NO KEY UPDATE;

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
  -- Read under the location lock, so a toggle can't change it until this commits
  -- (this also covers a slot with no settings row yet, which a row lock could not).
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
