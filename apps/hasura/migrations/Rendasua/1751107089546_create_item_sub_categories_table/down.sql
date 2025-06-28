-- Drop the trigger first
DROP TRIGGER IF EXISTS set_public_item_sub_categories_updated_at ON public.item_sub_categories;

-- Drop the item_sub_categories table
DROP TABLE IF EXISTS public.item_sub_categories;
