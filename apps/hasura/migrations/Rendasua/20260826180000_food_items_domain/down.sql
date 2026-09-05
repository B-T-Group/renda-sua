DROP TABLE IF EXISTS public.food_availability_slots;

DROP TABLE IF EXISTS public.food_item_settings;

ALTER TABLE public.items
DROP CONSTRAINT IF EXISTS items_preparation_minutes_check;

ALTER TABLE public.items
DROP COLUMN IF EXISTS preparation_minutes;

DELETE FROM public.item_sub_categories
WHERE item_category_id IN (
  SELECT id FROM public.item_categories WHERE name = 'Restaurant & Cooked Food'
);

DELETE FROM public.item_categories
WHERE name = 'Restaurant & Cooked Food';
