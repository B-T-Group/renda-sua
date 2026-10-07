-- Migration: agent_hold_ceiling
-- Description: Phase 1 agent caution hold ceiling (issue #450).
--   Flag-gated absolute XAF ceiling for eligible verified agents.
--   Master kill switch agent_hold_ceiling_enabled (default FALSE).
--   Eligibility: verified, not internal, min clean deliveries, no agent-fault failures, pilot city.
--   Loss guard: weekly XAF cap on agent-fault losses; auto-disables ceiling when exceeded.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, tags
)
SELECT
  'agent_hold_ceiling_enabled',
  'Agent Hold Ceiling Enabled',
  'Master kill switch for agent hold ceiling feature. When false, hold calculation uses raw percentage-based holds (bit-for-bit identical to legacy). When true, eligible verified agents have their hold capped at agent_hold_ceiling_xaf. Default false. Loss guard may auto-disable this.',
  'boolean',
  false,
  NULL,
  'active',
  ARRAY['feature-flag', 'agent', 'hold', 'ceiling']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'agent_hold_ceiling_enabled'
    AND country_code IS NULL
);

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value,
  country_code, status, tags
)
SELECT
  'agent_hold_ceiling_xaf',
  'Agent Hold Ceiling (XAF)',
  'Absolute XAF ceiling on agent caution hold for eligible verified agents. Only applies when agent_hold_ceiling_enabled=true and agent is eligible (verified, not internal, min clean deliveries, no agent-fault failures, in pilot city). If missing or <=0, ceiling is not applicable (falls back to raw percentage hold). Default 50000 XAF.',
  'number',
  50000,
  NULL,
  'active',
  ARRAY['agent', 'hold', 'ceiling']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'agent_hold_ceiling_xaf'
    AND country_code IS NULL
);

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, string_value,
  country_code, status, tags
)
SELECT
  'agent_hold_ceiling_city',
  'Agent Hold Ceiling Pilot City',
  'Pilot city for agent hold ceiling eligibility. Agent must have this city (case/accent/whitespace normalized) as their profile primary address city. Default Yaoundé.',
  'string',
  'Yaoundé',
  NULL,
  'active',
  ARRAY['agent', 'hold', 'ceiling', 'city']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'agent_hold_ceiling_city'
    AND country_code IS NULL
);

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value,
  country_code, status, tags
)
SELECT
  'agent_hold_ceiling_min_clean_deliveries',
  'Agent Hold Ceiling Min Clean Deliveries',
  'Minimum PIN-confirmed completed deliveries required for hold ceiling eligibility (orders.status=completed with delivery_pin_verified=true AND deliveryMethod=agent_delivery). Agent must also have zero agent_fault failed_deliveries (all-time). Default 10.',
  'number',
  10,
  NULL,
  'active',
  ARRAY['agent', 'hold', 'ceiling', 'eligibility']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'agent_hold_ceiling_min_clean_deliveries'
    AND country_code IS NULL
);

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value,
  country_code, status, tags
)
SELECT
  'agent_hold_loss_weekly_cap_xaf',
  'Agent Hold Loss Weekly Cap (XAF)',
  'Weekly XAF cap on agent-fault losses (sum of failed_deliveries.loss_amount where resolution_type=agent_fault over rolling 7 days). When exceeded and >0, loss guard auto-sets agent_hold_ceiling_enabled=false (idempotent) and alerts. Default 100000 XAF.',
  'number',
  100000,
  NULL,
  'active',
  ARRAY['agent', 'hold', 'loss-guard', 'ceiling']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'agent_hold_loss_weekly_cap_xaf'
    AND country_code IS NULL
);
