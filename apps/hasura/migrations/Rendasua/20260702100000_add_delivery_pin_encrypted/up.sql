ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_pin_encrypted TEXT;

COMMENT ON COLUMN public.orders.delivery_pin_encrypted IS
  'AES-256-GCM encrypted delivery PIN; server-only via HasuraSystemService';
