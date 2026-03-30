ALTER TABLE public.business_locations
  ADD COLUMN IF NOT EXISTS logo_url TEXT NULL;

COMMENT ON COLUMN public.business_locations.logo_url IS 'Public URL for this location''s logo image (e.g. S3 or external CDN).';
