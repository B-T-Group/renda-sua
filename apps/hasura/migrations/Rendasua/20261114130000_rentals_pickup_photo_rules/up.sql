-- Pickup photo freshness. Inserts the flag false. Turn it on by hand in DEV.
-- Production stays off. Do not enable this from apply-hasura or a workflow.

ALTER TABLE public.rental_inspection_media
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS slot_key text;

COMMENT ON COLUMN public.rental_inspection_media.captured_at IS
  'Server clock when the upload was received. Never a client timestamp.';

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_slot_key_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_slot_key_check
  CHECK (
    slot_key IS NULL
    OR slot_key ~ '^(overview|other_side|accessories|extra:[1-9][0-9]{0,2})$'
  );

ALTER TABLE public.rental_inspections
  ADD COLUMN IF NOT EXISTS pickup_guide_mode text,
  ADD COLUMN IF NOT EXISTS pickup_guide_version_id uuid;

ALTER TABLE public.rental_inspections
  DROP CONSTRAINT IF EXISTS rental_inspections_pickup_guide_mode_check;

ALTER TABLE public.rental_inspections
  ADD CONSTRAINT rental_inspections_pickup_guide_mode_check
  CHECK (pickup_guide_mode IS NULL OR pickup_guide_mode IN ('guide', 'blank'));

ALTER TABLE public.rental_inspections
  DROP CONSTRAINT IF EXISTS rental_inspections_pickup_guide_version_id_fkey;

ALTER TABLE public.rental_inspections
  ADD CONSTRAINT rental_inspections_pickup_guide_version_id_fkey
  FOREIGN KEY (pickup_guide_version_id)
  REFERENCES public.rental_inspection_versions(id) ON DELETE SET NULL;

ALTER TABLE public.rental_inspection_items
  ADD COLUMN IF NOT EXISTS guide_unconfirmed jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.rental_inspection_items
  DROP CONSTRAINT IF EXISTS rental_inspection_items_guide_unconfirmed_check;

ALTER TABLE public.rental_inspection_items
  ADD CONSTRAINT rental_inspection_items_guide_unconfirmed_check
  CHECK (jsonb_typeof(guide_unconfirmed) = 'array');

CREATE TABLE IF NOT EXISTS public.rental_inspection_slot_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.rental_inspections(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.rental_booking_units(id) ON DELETE RESTRICT,
  slot_key text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_inspection_slot_skips_slot_uidx UNIQUE (inspection_id, unit_id, slot_key),
  CONSTRAINT rental_inspection_slot_skips_reason_check
    CHECK (length(btrim(reason)) > 0 AND length(reason) <= 280),
  CONSTRAINT rental_inspection_slot_skips_slot_key_check
    CHECK (slot_key ~ '^extra:[1-9][0-9]{0,2}$')
);

COMMENT ON TABLE public.rental_inspection_slot_skips IS
  'Extra guide angles the business skipped, with the reason shown to the renter.';

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_pickup_photo_rules_enabled',
  'Rental pickup photo freshness',
  'When true, pickup photos are only on the calendar day of start_at in the listing timezone, from the mobile camera. A prior return can guide the checklist. The guide photos are not copied. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_pickup_photo_rules_enabled' AND country_code IS NULL
);
