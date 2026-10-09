-- Restore the previous delivery-commission percentages.

UPDATE public.application_configurations
SET number_value = 50.0, updated_at = NOW()
WHERE config_key = 'unverified_agent_base_delivery_commission'
  AND number_value = 80;

UPDATE public.application_configurations
SET number_value = 50.0, updated_at = NOW()
WHERE config_key = 'verified_agent_base_delivery_commission'
  AND number_value = 80;

UPDATE public.application_configurations
SET number_value = 20.0, updated_at = NOW()
WHERE config_key = 'verified_agent_per_km_delivery_commission'
  AND number_value = 80;
