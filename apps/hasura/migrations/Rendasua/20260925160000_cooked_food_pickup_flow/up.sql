-- Cooked-food item flag and order snapshots for pay-after-confirm pickup flow.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS is_cooked_food boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.items.is_cooked_food IS
  'True when the merchant flagged this as a cooked/restaurant dish. Drives stock, availability, and cooked-food pickup payment rules. Independent of category name.';

UPDATE public.items i
SET is_cooked_food = true
FROM public.item_sub_categories sc
JOIN public.item_categories c ON c.id = sc.item_category_id
WHERE i.item_sub_category_id = sc.id
  AND trim(c.name) = 'Restaurant & Cooked Food'
  AND i.is_cooked_food = false;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_cooked_food_pickup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pay_after_merchant_confirm boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.is_cooked_food_pickup IS
  'Snapshot at checkout: every line is cooked food and fulfillment is store pickup. Open orders keep this even if items change later.';
COMMENT ON COLUMN public.orders.pay_after_merchant_confirm IS
  'MoMo cooked-food pickup: no deposit at place-order; full amount requested after merchant confirms.';
