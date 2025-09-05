-- Manually drop the available_quantity column
ALTER TABLE public.business_inventory DROP COLUMN IF EXISTS available_quantity;
