-- Revert: restore verified_agent_base_delivery_commission to 0 where it was set to 50 by this migration.

UPDATE public.application_configurations
SET
  number_value = 0.0,
  updated_at = NOW()
WHERE config_key = 'verified_agent_base_delivery_commission'
  AND number_value = 50;
