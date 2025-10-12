-- Remove foreign key constraint for confirmed_by column in delivery_time_windows table

-- Drop foreign key constraint
ALTER TABLE public.delivery_time_windows 
DROP CONSTRAINT IF EXISTS fk_delivery_time_windows_confirmed_by;
