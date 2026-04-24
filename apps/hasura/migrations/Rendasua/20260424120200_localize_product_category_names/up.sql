-- Legacy upgrade: `name` -> `name_en` + `name_fr` (only when the old single column exists).
-- Installations created with 20260424120000 (name_en / name_fr) skip this work entirely.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'google_product_categories' AND column_name = 'name'
  ) THEN
    DROP INDEX IF EXISTS public.idx_google_product_categories_name;
    ALTER TABLE public.google_product_categories RENAME COLUMN name TO name_en;
    ALTER TABLE public.google_product_categories ADD COLUMN name_fr TEXT;
    DROP INDEX IF EXISTS public.idx_google_product_categories_fts;
    CREATE INDEX idx_google_product_categories_fts
      ON public.google_product_categories
      USING gin (to_tsvector('simple', coalesce(name_en, '') || ' ' || coalesce(name_fr, '')));
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fb_product_categories' AND column_name = 'name'
  ) THEN
    DROP INDEX IF EXISTS public.idx_fb_product_categories_name;
    ALTER TABLE public.fb_product_categories RENAME COLUMN name TO name_en;
    ALTER TABLE public.fb_product_categories ADD COLUMN name_fr TEXT;
    DROP INDEX IF EXISTS public.idx_fb_product_categories_fts;
    CREATE INDEX idx_fb_product_categories_fts
      ON public.fb_product_categories
      USING gin (to_tsvector('simple', coalesce(name_en, '') || ' ' || coalesce(name_fr, '')));
  END IF;
END
$$;
