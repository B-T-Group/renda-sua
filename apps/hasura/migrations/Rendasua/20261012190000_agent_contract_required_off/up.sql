-- Turn the agent agreement requirement off. Dev is set back to true after
-- this migration applies there; production stays false.
UPDATE public.application_configurations
SET boolean_value = false
WHERE config_key = 'agent_contract_required'
  AND country_code IS NULL;
