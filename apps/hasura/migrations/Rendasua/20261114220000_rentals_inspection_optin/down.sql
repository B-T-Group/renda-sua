DELETE FROM public.application_configurations
WHERE config_key = 'rentals_inspection_optin_enabled' AND country_code IS NULL;

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_capture_source_check;

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_captured_at_source_check;

ALTER TABLE public.rental_inspection_media
  DROP COLUMN IF EXISTS capture_source,
  DROP COLUMN IF EXISTS captured_at_source,
  DROP COLUMN IF EXISTS reused,
  DROP COLUMN IF EXISTS reused_from_media_id;

DROP TABLE IF EXISTS public.rental_item_baseline_photos;

ALTER TABLE public.rental_items
  DROP COLUMN IF EXISTS inspection_opted_in_at,
  DROP COLUMN IF EXISTS inspection_opt_in;
