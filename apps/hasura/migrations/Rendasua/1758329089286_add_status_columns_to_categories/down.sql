-- Remove indexes
DROP INDEX IF EXISTS public.idx_item_sub_categories_status;
DROP INDEX IF EXISTS public.idx_item_categories_status;

-- Remove status columns
ALTER TABLE public.item_sub_categories DROP COLUMN IF EXISTS status;
ALTER TABLE public.item_categories DROP COLUMN IF EXISTS status;
