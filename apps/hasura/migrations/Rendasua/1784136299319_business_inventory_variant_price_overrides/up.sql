-- Per-location price overrides for item variants (shared stock model).
-- Quantity stays on business_inventory; this table only overrides selling_price
-- when a variant's price differs at a specific location.

CREATE TABLE IF NOT EXISTS public.business_inventory_variant_price_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_inventory_id UUID NOT NULL
    REFERENCES public.business_inventory(id) ON UPDATE CASCADE ON DELETE CASCADE,
  item_variant_id UUID NOT NULL
    REFERENCES public.item_variants(id) ON UPDATE CASCADE ON DELETE CASCADE,
  selling_price NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_bivpo_selling_price_non_negative CHECK (selling_price >= 0),
  CONSTRAINT uq_bivpo_inventory_variant UNIQUE (business_inventory_id, item_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_bivpo_inventory_id
  ON public.business_inventory_variant_price_overrides (business_inventory_id);

CREATE INDEX IF NOT EXISTS idx_bivpo_variant_id
  ON public.business_inventory_variant_price_overrides (item_variant_id);

COMMENT ON TABLE public.business_inventory_variant_price_overrides IS
  'Optional per-location selling_price for a variant. Blank/absent = inherit variant.price or inventory.selling_price. Shared stock remains on business_inventory.';

COMMENT ON COLUMN public.business_inventory_variant_price_overrides.selling_price IS
  'Location-specific price for this variant; takes precedence over variant.price and inventory.selling_price.';
