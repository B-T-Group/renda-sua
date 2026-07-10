-- Unlock take_home rental operation mode alongside business_operated.

ALTER TYPE public.rental_operation_mode_enum ADD VALUE IF NOT EXISTS 'take_home';

ALTER TABLE public.rental_items
  DROP CONSTRAINT IF EXISTS rental_items_operation_mode_v1;

COMMENT ON TABLE public.rental_items IS
  'Business rental catalog items (operation_mode: business_operated | take_home)';
