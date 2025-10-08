-- Migration: 1758329400000_add_cancellation_fee_configuration_ga
-- Description: Remove cancellation fee configuration for Gabon (GA)

-- Remove cancellation fee configuration for Gabon
DELETE FROM public.application_configurations 
WHERE config_key = 'cancellation_fee' 
  AND country_code = 'GA' 
  AND tags @> ARRAY['cancellation', 'order'];
