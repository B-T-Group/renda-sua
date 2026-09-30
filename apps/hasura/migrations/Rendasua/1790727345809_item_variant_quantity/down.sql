ALTER TABLE public.item_variants DROP CONSTRAINT IF EXISTS item_variants_quantity_check;
ALTER TABLE public.item_variants DROP COLUMN IF EXISTS quantity;