-- Rename state_code column to state in delivery_time_slots table
-- This aligns the column name with the new naming convention

-- Rename the column
ALTER TABLE public.delivery_time_slots 
RENAME COLUMN state_code TO state;

-- Update the unique constraint to use the new column name
ALTER TABLE public.delivery_time_slots 
DROP CONSTRAINT IF EXISTS unique_slot_per_location;

ALTER TABLE public.delivery_time_slots 
ADD CONSTRAINT unique_slot_per_location UNIQUE (country_code, state, slot_name, slot_type);

-- Update the index to use the new column name
DROP INDEX IF EXISTS idx_delivery_time_slots_location;

CREATE INDEX idx_delivery_time_slots_location ON public.delivery_time_slots(country_code, state);

-- Add comment
COMMENT ON COLUMN public.delivery_time_slots.state IS 'State name (renamed from state_code)';
