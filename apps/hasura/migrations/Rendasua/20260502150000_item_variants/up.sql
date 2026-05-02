-- Item variants: catalog options per item (size, etc.). Inventory stays at business_inventory level.

CREATE TABLE public.item_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    price DECIMAL(10, 2),
    weight DECIMAL(10, 2),
    weight_unit weight_units_enum,
    dimensions TEXT,
    color TEXT,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_variants_price_check CHECK (price IS NULL OR price >= 0),
    CONSTRAINT item_variants_weight_check CHECK (weight IS NULL OR weight > 0)
);

CREATE UNIQUE INDEX item_variants_item_sku_unique
  ON public.item_variants (item_id, sku)
  WHERE sku IS NOT NULL AND trim(sku) <> '';

CREATE UNIQUE INDEX item_variants_one_default_per_item
  ON public.item_variants (item_id)
  WHERE is_default = TRUE;

CREATE INDEX idx_item_variants_item_id ON public.item_variants (item_id);
CREATE INDEX idx_item_variants_active ON public.item_variants (item_id, is_active);

CREATE TRIGGER set_public_item_variants_updated_at
    BEFORE UPDATE ON public.item_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TABLE public.item_variants IS 'Sellable options for an item (e.g. size); shared inventory via business_inventory';

-- Standalone images per variant (not tied to item_images)

CREATE TABLE public.item_variant_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_variant_id UUID NOT NULL REFERENCES public.item_variants(id) ON UPDATE CASCADE ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    caption TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX item_variant_images_one_primary_per_variant
  ON public.item_variant_images (item_variant_id)
  WHERE is_primary = TRUE;

CREATE INDEX idx_item_variant_images_variant ON public.item_variant_images (item_variant_id);

CREATE TRIGGER set_public_item_variant_images_updated_at
    BEFORE UPDATE ON public.item_variant_images
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TABLE public.item_variant_images IS 'Gallery images for an item variant';

-- Order line snapshot

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS item_variant_id UUID REFERENCES public.item_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_name TEXT,
  ADD COLUMN IF NOT EXISTS variant_snapshot JSONB;

CREATE INDEX idx_order_items_item_variant_id ON public.order_items (item_variant_id);

COMMENT ON COLUMN public.order_items.item_variant_id IS 'Selected catalog variant at order time';
COMMENT ON COLUMN public.order_items.variant_name IS 'Denormalized variant label at order time';
COMMENT ON COLUMN public.order_items.variant_snapshot IS 'JSON snapshot of variant attributes at purchase';
