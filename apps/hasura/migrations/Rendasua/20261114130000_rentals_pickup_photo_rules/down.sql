DELETE FROM public.application_configurations
WHERE config_key = 'rentals_pickup_photo_rules_enabled' AND country_code IS NULL;

DROP TABLE IF EXISTS public.rental_inspection_slot_skips;

ALTER TABLE public.rental_inspection_items
  DROP CONSTRAINT IF EXISTS rental_inspection_items_guide_unconfirmed_check;

ALTER TABLE public.rental_inspection_items
  DROP COLUMN IF EXISTS guide_unconfirmed;

ALTER TABLE public.rental_inspections
  DROP CONSTRAINT IF EXISTS rental_inspections_pickup_guide_version_id_fkey;

ALTER TABLE public.rental_inspections
  DROP CONSTRAINT IF EXISTS rental_inspections_pickup_guide_mode_check;

ALTER TABLE public.rental_inspections
  DROP COLUMN IF EXISTS pickup_guide_version_id;

ALTER TABLE public.rental_inspections
  DROP COLUMN IF EXISTS pickup_guide_mode;

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_slot_key_check;

ALTER TABLE public.rental_inspection_media
  DROP COLUMN IF EXISTS slot_key;

-- captured_at stays. Rolling back must not erase server capture stamps.
