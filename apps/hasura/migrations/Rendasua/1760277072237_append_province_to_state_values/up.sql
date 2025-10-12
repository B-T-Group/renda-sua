-- Append "Province" to state values in supported_country_states and delivery_time_slots tables
-- This makes state names more descriptive and consistent

-- Update supported_country_states table
UPDATE public.supported_country_states 
SET state_name = CONCAT(state_name, ' Province')
WHERE state_name IS NOT NULL 
  AND state_name != '' 
  AND state_name NOT LIKE '%Province%';

-- Update delivery_time_slots table
UPDATE public.delivery_time_slots 
SET state = CONCAT(state, ' Province')
WHERE state IS NOT NULL 
  AND state != '' 
  AND state NOT LIKE '%Province%';

-- Add comments
COMMENT ON TABLE public.supported_country_states IS 'Updated state names to include Province suffix';
COMMENT ON TABLE public.delivery_time_slots IS 'Updated state names to include Province suffix';
