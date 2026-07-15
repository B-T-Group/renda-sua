-- Variant-level inventory: stock may be tracked per (location, item) or per (location, item, variant).

ALTER TABLE public.business_inventory
  ADD COLUMN IF NOT EXISTS item_variant_id UUID
    REFERENCES public.item_variants(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Ensure composite FK: variant must belong to the same item as the inventory row.
CREATE UNIQUE INDEX IF NOT EXISTS item_variants_id_item_id_key
  ON public.item_variants (id, item_id);

ALTER TABLE public.business_inventory
  DROP CONSTRAINT IF EXISTS business_inventory_item_variant_item_fkey;

ALTER TABLE public.business_inventory
  ADD CONSTRAINT business_inventory_item_variant_item_fkey
  FOREIGN KEY (item_variant_id, item_id)
  REFERENCES public.item_variants (id, item_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

ALTER TABLE public.business_inventory
  DROP CONSTRAINT IF EXISTS unique_location_item;

CREATE UNIQUE INDEX IF NOT EXISTS business_inventory_location_item_null_variant_key
  ON public.business_inventory (business_location_id, item_id)
  WHERE item_variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_inventory_location_item_variant_key
  ON public.business_inventory (business_location_id, item_id, item_variant_id)
  WHERE item_variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_inventory_item_variant_id
  ON public.business_inventory (item_variant_id)
  WHERE item_variant_id IS NOT NULL;

COMMENT ON COLUMN public.business_inventory.item_variant_id IS
  'Optional variant for per-variant stock. NULL = item-level shared stock.';

COMMENT ON TABLE public.business_inventory IS
  'Tracks item inventory at specific business locations, optionally per variant.';
