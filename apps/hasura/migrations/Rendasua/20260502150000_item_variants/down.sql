DROP INDEX IF EXISTS public.idx_order_items_item_variant_id;

ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS variant_snapshot,
  DROP COLUMN IF EXISTS variant_name,
  DROP COLUMN IF EXISTS item_variant_id;

DROP TRIGGER IF EXISTS set_public_item_variant_images_updated_at ON public.item_variant_images;
DROP TABLE IF EXISTS public.item_variant_images;

DROP TRIGGER IF EXISTS set_public_item_variants_updated_at ON public.item_variants;
DROP TABLE IF EXISTS public.item_variants;
