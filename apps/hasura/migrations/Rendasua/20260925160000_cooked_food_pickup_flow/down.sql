ALTER TABLE public.orders
  DROP COLUMN IF EXISTS pay_after_merchant_confirm,
  DROP COLUMN IF EXISTS is_cooked_food_pickup;

ALTER TABLE public.items
  DROP COLUMN IF EXISTS is_cooked_food;
