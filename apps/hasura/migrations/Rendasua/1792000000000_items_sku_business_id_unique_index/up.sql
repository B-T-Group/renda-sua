-- Drop the items_sku_key unique constraint (unique on sku only)
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_sku_key;

-- Add unique index on composite columns (sku, business_id)
-- Allows same SKU across different businesses, but unique per business
CREATE UNIQUE INDEX items_sku_business_id_key ON public.items(sku, business_id);
