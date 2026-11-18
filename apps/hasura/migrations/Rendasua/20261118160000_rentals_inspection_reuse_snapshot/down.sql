DROP FUNCTION IF EXISTS public.rental_apply_pickup_reuse(uuid, jsonb);

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_derivative_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_derivative_check CHECK (
    derivative_key IS NULL
    OR derivative_key ~ '^(dev|prod)/rental-inspection/[0-9a-f-]{36}/[0-9a-f-]{36}\.view\.jpg$'
  );

ALTER TABLE public.rental_requests
  DROP COLUMN IF EXISTS inspection_policy_version;

ALTER TABLE public.rental_inspection_media
  DROP COLUMN IF EXISTS exif_captured_at;

ALTER TABLE public.rental_item_baseline_photos
  DROP COLUMN IF EXISTS exif_captured_at;
