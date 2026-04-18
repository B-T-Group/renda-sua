ALTER TABLE public.business_inventory
  ADD COLUMN promotion jsonb NULL;

COMMENT ON COLUMN public.business_inventory.promotion IS
  'Optional promotion payload: promoted, start, end (ISO UTC), sponsored';
