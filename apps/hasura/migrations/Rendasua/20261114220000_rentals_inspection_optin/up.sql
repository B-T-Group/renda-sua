-- Per-item inspection opt-in. Inserts the flag false. Does not change pickup photo rules.
-- Production stays off. Do not enable this from apply-hasura or a workflow.

ALTER TABLE public.rental_items
  ADD COLUMN IF NOT EXISTS inspection_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inspection_opted_in_at timestamptz;

COMMENT ON COLUMN public.rental_items.inspection_opt_in IS
  'When true, new bookings for this item can be inspected if the baseline is complete. Existing bookings are unchanged.';

COMMENT ON COLUMN public.rental_items.inspection_opted_in_at IS
  'When the business last turned inspection on. Null after they turn it off.';

CREATE TABLE IF NOT EXISTS public.rental_item_baseline_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_item_id uuid NOT NULL REFERENCES public.rental_items(id) ON DELETE CASCADE,
  slot_key text NOT NULL,
  object_key text NOT NULL,
  content_type text,
  byte_size integer,
  status text NOT NULL DEFAULT 'pending',
  captured_at timestamptz,
  captured_at_source text,
  capture_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_item_baseline_photos_slot_uidx UNIQUE (rental_item_id, slot_key),
  CONSTRAINT rental_item_baseline_photos_key_uidx UNIQUE (object_key)
);

ALTER TABLE public.rental_item_baseline_photos
  DROP CONSTRAINT IF EXISTS rental_item_baseline_photos_slot_check;

ALTER TABLE public.rental_item_baseline_photos
  ADD CONSTRAINT rental_item_baseline_photos_slot_check
  CHECK (slot_key IN ('overview', 'other_side', 'accessories'));

ALTER TABLE public.rental_item_baseline_photos
  DROP CONSTRAINT IF EXISTS rental_item_baseline_photos_status_check;

ALTER TABLE public.rental_item_baseline_photos
  ADD CONSTRAINT rental_item_baseline_photos_status_check
  CHECK (status IN ('pending', 'ready'));

ALTER TABLE public.rental_item_baseline_photos
  DROP CONSTRAINT IF EXISTS rental_item_baseline_photos_source_check;

ALTER TABLE public.rental_item_baseline_photos
  ADD CONSTRAINT rental_item_baseline_photos_source_check
  CHECK (capture_source IS NULL OR capture_source IN ('camera', 'gallery', 'web'));

ALTER TABLE public.rental_item_baseline_photos
  DROP CONSTRAINT IF EXISTS rental_item_baseline_photos_at_source_check;

ALTER TABLE public.rental_item_baseline_photos
  ADD CONSTRAINT rental_item_baseline_photos_at_source_check
  CHECK (captured_at_source IS NULL OR captured_at_source IN ('exif', 'upload'));

ALTER TABLE public.rental_item_baseline_photos
  DROP CONSTRAINT IF EXISTS rental_item_baseline_photos_key_check;

ALTER TABLE public.rental_item_baseline_photos
  ADD CONSTRAINT rental_item_baseline_photos_key_check
  CHECK (
    object_key ~ '^(dev|prod)/rental-inspection/baseline/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  );

COMMENT ON TABLE public.rental_item_baseline_photos IS
  'Private baseline photos required before an item can opt in to inspection.';

ALTER TABLE public.rental_inspection_media
  ADD COLUMN IF NOT EXISTS capture_source text,
  ADD COLUMN IF NOT EXISTS captured_at_source text,
  ADD COLUMN IF NOT EXISTS reused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reused_from_media_id uuid;

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_capture_source_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_capture_source_check
  CHECK (capture_source IS NULL OR capture_source IN ('camera', 'gallery', 'web'));

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_captured_at_source_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_captured_at_source_check
  CHECK (captured_at_source IS NULL OR captured_at_source IN ('exif', 'upload'));

COMMENT ON COLUMN public.rental_inspection_media.reused IS
  'True when the photo was copied from a prior return or the item baseline.';

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_inspection_optin_enabled',
  'Per-item rental inspection opt-in',
  'When true, a new booking is inspected only if that rental item opted in and has Overview, Other side, and Accessories baseline photos. The country inspection flag no longer stamps new bookings. Existing stamped bookings stay inspected. Pickup photos can come from the camera, the gallery, or the web anytime before start, and can be reused unless the last return reported damage. Default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_inspection_optin_enabled' AND country_code IS NULL
);
