-- If an older revision of 20260424120000 attached taxonomy FKs to public.items, move them to item_sub_categories.
-- Safe to run when columns already exist only on item_sub_categories (idempotent / no-ops where applicable).

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS fk_items_google_product_category;
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS fk_items_fb_product_category;
DROP INDEX IF EXISTS public.idx_items_google_product_category;
DROP INDEX IF EXISTS public.idx_items_fb_product_category;
ALTER TABLE public.items DROP COLUMN IF EXISTS google_product_category;
ALTER TABLE public.items DROP COLUMN IF EXISTS fb_product_category;

ALTER TABLE public.item_sub_categories
  ADD COLUMN IF NOT EXISTS google_product_category BIGINT,
  ADD COLUMN IF NOT EXISTS fb_product_category INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_item_sub_categories_google_product_category'
  ) THEN
    ALTER TABLE public.item_sub_categories
      ADD CONSTRAINT fk_item_sub_categories_google_product_category
      FOREIGN KEY (google_product_category) REFERENCES public.google_product_categories (id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_item_sub_categories_fb_product_category'
  ) THEN
    ALTER TABLE public.item_sub_categories
      ADD CONSTRAINT fk_item_sub_categories_fb_product_category
      FOREIGN KEY (fb_product_category) REFERENCES public.fb_product_categories (id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_item_sub_categories_google_product_category
  ON public.item_sub_categories (google_product_category) WHERE google_product_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_sub_categories_fb_product_category
  ON public.item_sub_categories (fb_product_category) WHERE fb_product_category IS NOT NULL;
