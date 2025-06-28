-- Drop trigger first
DROP TRIGGER IF EXISTS set_public_business_inventory_updated_at ON public.business_inventory;

-- Drop table
DROP TABLE IF EXISTS public.business_inventory;
