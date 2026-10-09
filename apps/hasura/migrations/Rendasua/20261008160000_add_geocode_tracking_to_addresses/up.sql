-- Track daily geocode attempts so addresses without coordinates are tried once per window.

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS geocode_attempted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS geocode_status text NULL;

ALTER TABLE public.addresses
  DROP CONSTRAINT IF EXISTS addresses_geocode_status_check;

ALTER TABLE public.addresses
  ADD CONSTRAINT addresses_geocode_status_check
  CHECK (
    geocode_status IS NULL
    OR geocode_status IN ('success', 'not_found', 'country_mismatch')
  );

CREATE INDEX IF NOT EXISTS addresses_geocode_pending_idx
  ON public.addresses (geocode_attempted_at)
  WHERE latitude IS NULL;
