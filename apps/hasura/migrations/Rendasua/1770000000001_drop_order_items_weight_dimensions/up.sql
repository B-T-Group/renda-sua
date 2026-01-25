ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS dimensions,
  DROP COLUMN IF EXISTS weight,
  DROP COLUMN IF EXISTS weight_unit;
