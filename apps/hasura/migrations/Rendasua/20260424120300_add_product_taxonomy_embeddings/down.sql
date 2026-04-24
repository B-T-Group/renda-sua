ALTER TABLE public.google_product_categories
  DROP COLUMN IF EXISTS embedding;

ALTER TABLE public.fb_product_categories
  DROP COLUMN IF EXISTS embedding;

-- Keep extension "vector" installed; other features may depend on it.
