-- Agent keeps 80% of the base delivery fee and 80% of the per-km fee.
-- Rendasua keeps the remainder (20% before any partner delivery commission).

UPDATE public.application_configurations
SET
  number_value = 80.0,
  updated_at = NOW()
WHERE config_key IN (
  'unverified_agent_base_delivery_commission',
  'verified_agent_base_delivery_commission',
  'unverified_agent_per_km_delivery_commission',
  'verified_agent_per_km_delivery_commission'
);
