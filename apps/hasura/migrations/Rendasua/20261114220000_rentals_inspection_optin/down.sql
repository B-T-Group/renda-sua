-- Deactivate every opt-in flag row. Do not delete them: a leftover country row
-- would become the live value the next time the up migration inserts only the global row.
UPDATE public.application_configurations
SET boolean_value = false, status = 'inactive'
WHERE config_key = 'rentals_inspection_optin_enabled';

-- Dropping the baseline table is destructive once photos exist. Refuse while it has rows.
DO $$
BEGIN
  IF to_regclass('public.rental_item_baseline_photos') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.rental_item_baseline_photos) THEN
    RAISE EXCEPTION 'rental_item_baseline_photos is not empty; refusing to drop it';
  END IF;
END $$;

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

-- Dropping these columns deletes the opt-in choice. Run this only before the feature is used.
ALTER TABLE public.rental_items
  DROP COLUMN IF EXISTS inspection_opted_in_at,
  DROP COLUMN IF EXISTS inspection_opt_in;
