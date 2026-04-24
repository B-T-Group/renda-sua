ALTER TABLE public.item_sub_categories DROP CONSTRAINT IF EXISTS fk_item_sub_categories_google_product_category;
ALTER TABLE public.item_sub_categories DROP CONSTRAINT IF EXISTS fk_item_sub_categories_fb_product_category;

DROP INDEX IF EXISTS public.idx_item_sub_categories_google_product_category;
DROP INDEX IF EXISTS public.idx_item_sub_categories_fb_product_category;

ALTER TABLE public.item_sub_categories DROP COLUMN IF EXISTS google_product_category;
ALTER TABLE public.item_sub_categories DROP COLUMN IF EXISTS fb_product_category;

DROP INDEX IF EXISTS public.idx_google_product_categories_fts;
DROP INDEX IF EXISTS public.idx_fb_product_categories_fts;

DROP TABLE IF EXISTS public.google_product_categories;
DROP TABLE IF EXISTS public.fb_product_categories;
