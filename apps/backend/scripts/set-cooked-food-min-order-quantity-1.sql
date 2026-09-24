-- Post-deploy: force min_order_quantity = 1 for all cooked-food items.
-- Safe to re-run. Category name must match FOOD_CATEGORY_NAME.

BEGIN;

UPDATE public.items AS i
SET
  min_order_quantity = 1,
  updated_at = now()
FROM public.item_sub_categories AS sc
JOIN public.item_categories AS c ON c.id = sc.item_category_id
WHERE i.item_sub_category_id = sc.id
  AND c.name = 'Restaurant & Cooked Food'
  AND i.min_order_quantity IS DISTINCT FROM 1;

COMMIT;
