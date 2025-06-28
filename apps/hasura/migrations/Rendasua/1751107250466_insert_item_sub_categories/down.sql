-- Remove inserted item sub-categories
DELETE FROM public.item_sub_categories WHERE item_category_id IN (1, 2, 3, 4, 5);
