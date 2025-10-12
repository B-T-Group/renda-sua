-- Reverse migration: Remove "Province" suffix from state values

-- Update supported_country_states table
UPDATE public.supported_country_states 
SET state_name = REPLACE(state_name, ' Province', '')
WHERE state_name IS NOT NULL 
  AND state_name LIKE '%Province%';

-- Update delivery_time_slots table
UPDATE public.delivery_time_slots 
SET state = REPLACE(state, ' Province', '')
WHERE state IS NOT NULL 
  AND state LIKE '%Province%';

-- Add comments
COMMENT ON TABLE public.supported_country_states IS 'Removed Province suffix from state names';
COMMENT ON TABLE public.delivery_time_slots IS 'Removed Province suffix from state names';
