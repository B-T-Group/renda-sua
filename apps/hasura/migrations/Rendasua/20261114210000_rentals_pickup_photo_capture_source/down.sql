UPDATE public.application_configurations
SET description = 'When true, pickup photos are only on the calendar day of start_at in the listing timezone, from the mobile camera. A prior return can guide the checklist. The guide photos are not copied. Country row first, then global row, default false.'
WHERE config_key = 'rentals_pickup_photo_rules_enabled'
  AND country_code IS NULL;

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_capture_source_check;

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_captured_at_source_check;

ALTER TABLE public.rental_inspection_media
  DROP COLUMN IF EXISTS capture_source,
  DROP COLUMN IF EXISTS captured_at_source;

COMMENT ON COLUMN public.rental_inspection_media.captured_at IS
  'Server clock when the upload was received. Never a client timestamp.';
