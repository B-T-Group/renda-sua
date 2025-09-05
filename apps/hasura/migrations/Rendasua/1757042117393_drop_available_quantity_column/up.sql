-- Drop the available_quantity column since we're using computed field instead
ALTER TABLE public.business_inventory DROP COLUMN IF EXISTS available_quantity;
