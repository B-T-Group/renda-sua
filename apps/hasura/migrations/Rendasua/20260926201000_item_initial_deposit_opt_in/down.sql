ALTER TABLE public.orders
  DROP COLUMN IF EXISTS deposit_minimum_applied;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_initial_deposit_percent_check;

ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS initial_deposit_amount,
  DROP COLUMN IF EXISTS initial_deposit_percent;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_initial_deposit_check;

ALTER TABLE public.items
  DROP COLUMN IF EXISTS initial_deposit_percent,
  DROP COLUMN IF EXISTS initial_deposit_enabled;
