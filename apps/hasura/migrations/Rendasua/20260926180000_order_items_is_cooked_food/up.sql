-- Snapshot cooked-food status on each order line at checkout.
-- Catalog items.is_cooked_food can change later; open orders keep this value.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_cooked_food boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.order_items.is_cooked_food IS
  'Snapshot at checkout: this line was cooked food (item flag or Restaurant & Cooked Food category).';

UPDATE public.order_items oi
SET is_cooked_food = true
FROM public.items i
LEFT JOIN public.item_sub_categories sc ON sc.id = i.item_sub_category_id
LEFT JOIN public.item_categories c ON c.id = sc.item_category_id
WHERE oi.item_id = i.id
  AND oi.is_cooked_food = false
  AND (
    i.is_cooked_food = true
    OR trim(c.name) = 'Restaurant & Cooked Food'
  );
