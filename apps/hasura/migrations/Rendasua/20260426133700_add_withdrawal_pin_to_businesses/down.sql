ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS withdrawal_pin_enabled,
  DROP COLUMN IF EXISTS withdrawal_pin_hashed;

