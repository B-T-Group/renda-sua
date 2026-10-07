-- Remove auth_gate_ul_fallback flag
DELETE FROM public.application_configurations
WHERE config_key = 'auth_gate_ul_fallback';
