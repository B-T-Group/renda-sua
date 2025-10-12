-- Reverse Gabon states data migration
-- 1. Restore "Littoral" state (if it existed before)
-- 2. Reset "Estuaire" state fast delivery configuration

-- Note: We cannot restore the deleted "Littoral" state without knowing its original data
-- This down migration only resets the Estuaire fast delivery configuration

-- Reset "Estuaire" state fast delivery configuration to NULL or default
UPDATE public.supported_country_states 
SET fast_delivery = NULL
WHERE country_code = 'GA' AND state_code = 'Estuaire';

-- Add comment
COMMENT ON TABLE public.supported_country_states IS 'Reverted Estuaire fast delivery configuration';
