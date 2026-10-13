-- Require a signed agent agreement again. Dev is already true; this turns production back on.
UPDATE public.application_configurations
SET boolean_value = true
WHERE config_key = 'agent_contract_required'
  AND country_code IS NULL;
