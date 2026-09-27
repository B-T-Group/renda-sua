-- Merchant opt-in initial deposit for non-food items.
-- Existing items stay off, so pay-at-delivery no longer charges a platform deposit
-- until the merchant turns this on.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS initial_deposit_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_deposit_percent smallint;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_initial_deposit_check;

ALTER TABLE public.items
  ADD CONSTRAINT items_initial_deposit_check
  CHECK (
    (
      initial_deposit_enabled = false
      AND initial_deposit_percent IS NULL
    )
    OR (
      initial_deposit_enabled = true
      AND initial_deposit_percent IS NOT NULL
      AND initial_deposit_percent >= 1
      AND initial_deposit_percent <= 25
    )
  );

COMMENT ON COLUMN public.items.initial_deposit_enabled IS
  'When true, Mobile Money pay-at-delivery/pickup collects an initial deposit of initial_deposit_percent of this item price. Cooked food must stay false.';

COMMENT ON COLUMN public.items.initial_deposit_percent IS
  'Whole-number percent (1-25) of the item price collected up front. Null when the deposit is off.';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS initial_deposit_percent smallint,
  ADD COLUMN IF NOT EXISTS initial_deposit_amount numeric;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_initial_deposit_percent_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_initial_deposit_percent_check
  CHECK (
    initial_deposit_percent IS NULL
    OR (
      initial_deposit_percent >= 1
      AND initial_deposit_percent <= 25
    )
  );

COMMENT ON COLUMN public.order_items.initial_deposit_percent IS
  'Snapshot of the item deposit percent at checkout. Null when this line did not require a deposit.';

COMMENT ON COLUMN public.order_items.initial_deposit_amount IS
  'Snapshot of this line''s deposit (price x quantity x percent) before any order-level XAF minimum.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deposit_minimum_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.deposit_minimum_applied IS
  'True when the charged deposit was raised to the 150 XAF Mobile Money minimum.';
