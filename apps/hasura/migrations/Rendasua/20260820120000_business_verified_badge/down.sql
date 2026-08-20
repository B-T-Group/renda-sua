-- Revert is_verified to a generated alias of lifecycle_status = 'active'.
-- Writable badge values are lost; Active merchants become verified again.

ALTER TABLE public.businesses DROP COLUMN is_verified;

ALTER TABLE public.businesses
  ADD COLUMN is_verified BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status = 'active'
  ) STORED;

COMMENT ON COLUMN public.businesses.is_verified IS
  'Indicates if the business account has been verified';
