DROP INDEX IF EXISTS public.idx_business_inventory_item_variant_id;
DROP INDEX IF EXISTS public.business_inventory_location_item_variant_key;
DROP INDEX IF EXISTS public.business_inventory_location_item_null_variant_key;

ALTER TABLE public.business_inventory
  DROP CONSTRAINT IF EXISTS business_inventory_item_variant_item_fkey;

-- Fail if duplicate (location, item) rows exist with non-null variants.
ALTER TABLE public.business_inventory
  ADD CONSTRAINT unique_location_item UNIQUE (business_location_id, item_id);

ALTER TABLE public.business_inventory
  DROP COLUMN IF EXISTS item_variant_id;

DROP INDEX IF EXISTS public.item_variants_id_item_id_key;
