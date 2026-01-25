ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS dimensions VARCHAR(100),
  ADD COLUMN IF NOT EXISTS weight DECIMAL(8,3),
  ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(10);

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_weight_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_weight_check CHECK (weight IS NULL OR weight > 0);
