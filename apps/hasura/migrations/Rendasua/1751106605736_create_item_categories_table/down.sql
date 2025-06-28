-- Drop the trigger first
DROP TRIGGER IF EXISTS set_public_item_categories_updated_at ON public.item_categories;

-- Drop the item_categories table
DROP TABLE IF EXISTS public.item_categories;
