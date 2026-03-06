-- Migration: trim_cm_delivery_time_slots_state
-- Description: For country_code = 'CM', trim \" Region Province\" suffix from delivery_time_slots.state
-- Example: \"Littoral Region Province\" -> \"Littoral\"

UPDATE public.delivery_time_slots
SET state = REPLACE(state, ' Region Province', '')
WHERE country_code = 'CM'
  AND state IS NOT NULL
  AND state LIKE '% Region Province';

COMMENT ON TABLE public.delivery_time_slots IS 'Trimmed \" Region Province\" suffix from CM state names in delivery_time_slots';

