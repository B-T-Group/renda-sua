ALTER TABLE public.item_variants
  ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.item_variants
  ADD CONSTRAINT item_variants_quantity_check CHECK (quantity >= 1);

COMMENT ON COLUMN public.item_variants.quantity IS 'Base units included in one sale of this variant. 1 matches the parent item.';