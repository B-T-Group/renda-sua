-- Data migration: set verified_agent_base_delivery_commission from 0 to 50 (percentage of base delivery fee for verified agents).

UPDATE public.application_configurations
SET
  number_value = 50.0,
  updated_at = NOW()
WHERE config_key = 'verified_agent_base_delivery_commission'
  AND number_value = 0;
