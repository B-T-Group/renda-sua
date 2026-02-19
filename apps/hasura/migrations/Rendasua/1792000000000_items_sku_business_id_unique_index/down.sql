-- Drop the composite unique index
DROP INDEX IF EXISTS public.items_sku_business_id_key;

-- Restore the original items_sku_key unique constraint on sku only
ALTER TABLE public.items ADD CONSTRAINT items_sku_key UNIQUE (sku);
