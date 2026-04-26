ALTER TABLE public.businesses
  ADD COLUMN withdrawal_pin_hashed TEXT,
  ADD COLUMN withdrawal_pin_enabled BOOLEAN NOT NULL DEFAULT FALSE;

