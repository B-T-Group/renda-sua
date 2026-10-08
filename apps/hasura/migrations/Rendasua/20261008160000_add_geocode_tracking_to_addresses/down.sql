DROP INDEX IF EXISTS public.addresses_geocode_pending_idx;

ALTER TABLE public.addresses
  DROP CONSTRAINT IF EXISTS addresses_geocode_status_check;

ALTER TABLE public.addresses
  DROP COLUMN IF EXISTS geocode_status,
  DROP COLUMN IF EXISTS geocode_attempted_at;
