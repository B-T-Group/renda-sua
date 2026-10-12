DROP TRIGGER IF EXISTS set_public_agent_contracts_updated_at ON public.agent_contracts;
DROP TABLE IF EXISTS public.agent_contracts;

DELETE FROM public.application_configurations
WHERE config_key = 'agent_contract_required' AND country_code IS NULL;
