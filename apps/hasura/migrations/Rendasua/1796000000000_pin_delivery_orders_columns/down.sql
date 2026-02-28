ALTER TABLE public.orders
  DROP COLUMN IF EXISTS delivery_pin_hash,
  DROP COLUMN IF EXISTS delivery_pin_attempts,
  DROP COLUMN IF EXISTS delivery_overwrite_code_hash,
  DROP COLUMN IF EXISTS delivery_overwrite_code_used_at;
