DROP FUNCTION IF EXISTS public.try_release_business_inventory(uuid, integer);
DROP FUNCTION IF EXISTS public.try_reserve_business_inventory(uuid, integer);

ALTER TABLE public.business_inventory
  DROP CONSTRAINT IF EXISTS business_inventory_reserved_quantity_bounds;
