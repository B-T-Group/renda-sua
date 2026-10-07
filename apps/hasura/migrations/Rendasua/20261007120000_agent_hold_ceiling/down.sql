-- Revert: remove agent hold ceiling configs
DELETE FROM public.application_configurations
WHERE config_key IN (
  'agent_hold_ceiling_enabled',
  'agent_hold_ceiling_xaf',
  'agent_hold_ceiling_city',
  'agent_hold_ceiling_min_clean_deliveries',
  'agent_hold_loss_weekly_cap_xaf'
);
