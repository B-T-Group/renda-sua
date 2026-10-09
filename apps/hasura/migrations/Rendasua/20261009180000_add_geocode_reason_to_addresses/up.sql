-- Why the nightly geocode cron did not store coordinates for an address (ops visibility).
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS geocode_reason text NULL;
