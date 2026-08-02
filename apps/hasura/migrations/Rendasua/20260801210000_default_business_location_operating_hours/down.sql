ALTER TABLE public.business_locations
  ALTER COLUMN operating_hours DROP NOT NULL;

ALTER TABLE public.business_locations
  ALTER COLUMN operating_hours DROP DEFAULT;
