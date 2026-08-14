-- Remove REMBG cleanup feature flag
DELETE FROM public.application_configurations 
WHERE config_key = 'use_rembg_cleanup';
