UPDATE public.application_configurations
SET boolean_value = false
WHERE config_key = 'agent_contract_required'
  AND country_code IS NULL;
