-- 1. Remove business_id and brand_id from items
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS fk_items_business;
ALTER TABLE public.items DROP COLUMN IF EXISTS business_id;
DROP INDEX IF EXISTS idx_items_business_id;

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS fk_items_brand;
ALTER TABLE public.items DROP COLUMN IF EXISTS brand_id;
DROP INDEX IF EXISTS idx_items_brand_id;

-- 2. Drop brands table
DROP TRIGGER IF EXISTS set_public_brands_updated_at ON public.brands;
DROP TABLE IF EXISTS public.brands;

-- 3. Restore brand column in items
ALTER TABLE public.items ADD COLUMN brand TEXT; 