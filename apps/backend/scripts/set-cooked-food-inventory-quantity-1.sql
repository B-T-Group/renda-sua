-- Post-deploy: set cooked-food inventory to quantity 1 with no reserves.
-- Run ONLY after the backend that skips food reserve/release/completion
-- stock mutations is deployed. Do not apply via Hasura migrate.
--
-- Category name must match FOOD_CATEGORY_NAME ('Restaurant & Cooked Food').

BEGIN;

UPDATE public.business_inventory AS bi
SET
  quantity = 1,
  reserved_quantity = 0,
  updated_at = now()
FROM public.items AS i
JOIN public.item_sub_categories AS sc ON sc.id = i.item_sub_category_id
JOIN public.item_categories AS c ON c.id = sc.item_category_id
WHERE bi.item_id = i.id
  AND c.name = 'Restaurant & Cooked Food'
  AND (bi.quantity <> 1 OR bi.reserved_quantity <> 0);

COMMIT;
