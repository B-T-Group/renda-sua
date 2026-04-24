-- Revert 20260424120100: remove taxonomy from item_sub_categories (re-enables a prior items-based layout only if re-applied manually).
ALTER TABLE public.item_sub_categories
  DROP CONSTRAINT IF EXISTS fk_item_sub_categories_google_product_category;
ALTER TABLE public.item_sub_categories
  DROP CONSTRAINT IF EXISTS fk_item_sub_categories_fb_product_category;
DROP INDEX IF EXISTS public.idx_item_sub_categories_google_product_category;
DROP INDEX IF EXISTS public.idx_item_sub_categories_fb_product_category;
ALTER TABLE public.item_sub_categories
  DROP COLUMN IF EXISTS google_product_category;
ALTER TABLE public.item_sub_categories
  DROP COLUMN IF EXISTS fb_product_category;
