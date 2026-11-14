-- Gallery and anytime pickup photos. Nullable columns. Does not turn the flag on.

ALTER TABLE public.rental_inspection_media
  ADD COLUMN IF NOT EXISTS capture_source text,
  ADD COLUMN IF NOT EXISTS captured_at_source text;

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_capture_source_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_capture_source_check
  CHECK (capture_source IS NULL OR capture_source IN ('camera', 'gallery'));

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_captured_at_source_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_captured_at_source_check
  CHECK (captured_at_source IS NULL OR captured_at_source IN ('exif', 'upload'));

COMMENT ON COLUMN public.rental_inspection_media.captured_at IS
  'EXIF DateTimeOriginal when the app sends one. A value with no offset is read in the listing timezone. Otherwise the server clock at presign.';

COMMENT ON COLUMN public.rental_inspection_media.capture_source IS
  'camera or gallery when pickup photo rules are on. Null otherwise.';

COMMENT ON COLUMN public.rental_inspection_media.captured_at_source IS
  'exif when DateTimeOriginal parsed. upload when the server clock was used. Null when the rules flag is off.';

UPDATE public.application_configurations
SET description = 'When true, pickup photos can be added anytime before start_at from the mobile camera or the gallery. captured_at is EXIF DateTimeOriginal when present, otherwise the upload time. Web stays read-only. Country row first, then global row, default false.'
WHERE config_key = 'rentals_pickup_photo_rules_enabled'
  AND country_code IS NULL;
