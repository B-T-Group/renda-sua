-- Reverse migration: Rename state column back to state_code in delivery_time_slots table

-- Rename the column back
ALTER TABLE public.delivery_time_slots 
RENAME COLUMN state TO state_code;

-- Update the unique constraint to use the old column name
ALTER TABLE public.delivery_time_slots 
DROP CONSTRAINT IF EXISTS unique_slot_per_location;

ALTER TABLE public.delivery_time_slots 
ADD CONSTRAINT unique_slot_per_location UNIQUE (country_code, state_code, slot_name, slot_type);

-- Update the index to use the old column name
DROP INDEX IF EXISTS idx_delivery_time_slots_location;

CREATE INDEX idx_delivery_time_slots_location ON public.delivery_time_slots(country_code, state_code);

-- Add comment
COMMENT ON COLUMN public.delivery_time_slots.state_code IS 'State code (reverted from state)';
