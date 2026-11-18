-- Renter decline at pickup. Inserts the flag false. Does not enable it.
-- Production stays off. Do not enable this from apply-hasura or a workflow.

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS condition_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS refund_currency text,
  ADD COLUMN IF NOT EXISTS refund_provider text,
  ADD COLUMN IF NOT EXISTS refund_provider_ref text,
  ADD COLUMN IF NOT EXISTS refund_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_next_at timestamptz;

ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_refund_status_check;

ALTER TABLE public.rental_bookings
  ADD CONSTRAINT rental_bookings_refund_status_check
  CHECK (refund_status IN ('none', 'refund_pending', 'refunded', 'failed'));

COMMENT ON COLUMN public.rental_bookings.condition_declined_at IS
  'Set only by the renter condition-decline compare-and-set. Null when start, business cancel, or the auto-cancel cron won.';

COMMENT ON COLUMN public.rental_bookings.refund_status IS
  'MoMo refund of a collect that already succeeded. none until a decline needs one. Updated by provider poll, not by the client.';

CREATE TABLE IF NOT EXISTS public.rental_condition_declines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  version_id uuid NOT NULL,
  reason text NOT NULL,
  reason_text text,
  money_rail text NOT NULL,
  money_amount numeric NOT NULL DEFAULT 0,
  money_currency text,
  phone_mask text,
  declined_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_condition_declines_booking_uidx UNIQUE (rental_booking_id),
  CONSTRAINT rental_condition_declines_version_fkey
    FOREIGN KEY (version_id) REFERENCES public.rental_inspection_versions(id)
);

ALTER TABLE public.rental_condition_declines
  DROP CONSTRAINT IF EXISTS rental_condition_declines_reason_check;

ALTER TABLE public.rental_condition_declines
  ADD CONSTRAINT rental_condition_declines_reason_check
  CHECK (reason IN ('damaged', 'missing_accessory', 'not_the_item', 'other'));

ALTER TABLE public.rental_condition_declines
  DROP CONSTRAINT IF EXISTS rental_condition_declines_rail_check;

ALTER TABLE public.rental_condition_declines
  ADD CONSTRAINT rental_condition_declines_rail_check
  CHECK (money_rail IN ('card', 'wallet', 'momo_unpaid', 'momo_paid'));

ALTER TABLE public.rental_condition_declines
  DROP CONSTRAINT IF EXISTS rental_condition_declines_other_text_check;

ALTER TABLE public.rental_condition_declines
  ADD CONSTRAINT rental_condition_declines_other_text_check
  CHECK (reason <> 'other' OR (reason_text IS NOT NULL AND length(btrim(reason_text)) > 0));

CREATE INDEX IF NOT EXISTS rental_condition_declines_created_idx
  ON public.rental_condition_declines (created_at DESC);

COMMENT ON TABLE public.rental_condition_declines IS
  'Renter rejected the pickup condition. One row per booking. A repeat is the same decline.';

ALTER TABLE public.rental_condition_declines
  DROP CONSTRAINT IF EXISTS rental_condition_declines_booking_version_uidx;

ALTER TABLE public.rental_condition_declines
  DROP CONSTRAINT IF EXISTS rental_condition_declines_booking_uidx;

ALTER TABLE public.rental_condition_declines
  ADD CONSTRAINT rental_condition_declines_booking_uidx UNIQUE (rental_booking_id);

ALTER TABLE public.rental_condition_declines
  DROP CONSTRAINT IF EXISTS rental_condition_declines_version_fkey;

ALTER TABLE public.rental_condition_declines
  ADD CONSTRAINT rental_condition_declines_version_fkey
  FOREIGN KEY (version_id) REFERENCES public.rental_inspection_versions(id);

CREATE TABLE IF NOT EXISTS public.rental_condition_decline_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  decline_id uuid REFERENCES public.rental_condition_declines(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  content_type text,
  byte_size integer,
  expected_byte_size integer,
  capture_source text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_condition_decline_photos_key_uidx UNIQUE (object_key)
);

ALTER TABLE public.rental_condition_decline_photos
  DROP CONSTRAINT IF EXISTS rental_condition_decline_photos_status_check;

ALTER TABLE public.rental_condition_decline_photos
  ADD CONSTRAINT rental_condition_decline_photos_status_check
  CHECK (status IN ('pending', 'ready'));

ALTER TABLE public.rental_condition_decline_photos
  DROP CONSTRAINT IF EXISTS rental_condition_decline_photos_source_check;

ALTER TABLE public.rental_condition_decline_photos
  ADD CONSTRAINT rental_condition_decline_photos_source_check
  CHECK (capture_source IS NULL OR capture_source IN ('camera', 'gallery', 'web'));

ALTER TABLE public.rental_condition_decline_photos
  DROP CONSTRAINT IF EXISTS rental_condition_decline_photos_key_check;

ALTER TABLE public.rental_condition_decline_photos
  ADD CONSTRAINT rental_condition_decline_photos_key_check
  CHECK (
    object_key ~ '^(dev|prod)/rental-inspection/decline/(pending/)?[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  );

COMMENT ON TABLE public.rental_condition_decline_photos IS
  'Private evidence for a condition decline. Not a public listing photo and not a pickup or return report.';

CREATE OR REPLACE VIEW public.rental_condition_decline_counts_90d AS
SELECT
  ('renter:' || b.client_id::text) AS id,
  'renter'::text AS role,
  b.client_id AS party_id,
  count(*)::int AS decline_count,
  max(d.created_at) AS last_decline_at
FROM public.rental_condition_declines d
JOIN public.rental_bookings b ON b.id = d.rental_booking_id
WHERE d.created_at >= (now() - interval '90 days')
GROUP BY b.client_id
UNION ALL
SELECT
  ('business:' || b.business_id::text) AS id,
  'business'::text AS role,
  b.business_id AS party_id,
  count(*)::int AS decline_count,
  max(d.created_at) AS last_decline_at
FROM public.rental_condition_declines d
JOIN public.rental_bookings b ON b.id = d.rental_booking_id
WHERE d.created_at >= (now() - interval '90 days')
GROUP BY b.business_id;

COMMENT ON VIEW public.rental_condition_decline_counts_90d IS
  'Condition declines in the last 90 days, per renter and per business. Support flags a party at 5 or more.';

CREATE OR REPLACE VIEW public.rental_business_pickup_reach_90d AS
SELECT
  b.business_id AS id,
  b.business_id,
  count(DISTINCT b.id)::int AS pickups_reached
FROM public.rental_bookings b
WHERE b.id IN (
  SELECT d.rental_booking_id
  FROM public.rental_condition_declines d
  WHERE d.created_at >= (now() - interval '90 days')
  UNION
  SELECT i.rental_booking_id
  FROM public.rental_inspection_acks a
  JOIN public.rental_inspection_versions v ON v.id = a.version_id
  JOIN public.rental_inspections i ON i.id = v.inspection_id
  WHERE a.decision = 'accept'
    AND a.persona = 'client'
    AND i.stage = 'pickup'
    AND a.created_at >= (now() - interval '90 days')
)
GROUP BY b.business_id;

COMMENT ON VIEW public.rental_business_pickup_reach_90d IS
  'Bookings that reached a pickup report in 90 days: the renter accepted it or declined the condition.';

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_pickup_decline_enabled',
  'Renter decline at pickup',
  'When true, a renter can decline an inspected pickup condition before the rental starts. That cancels the booking, frees the unit, voids a card hold, releases a wallet hold, and refunds a Mobile Money collect that already succeeded. Listing condition photos, the 90-day counters, and the store-insights stat use the same flag. Default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_pickup_decline_enabled' AND country_code IS NULL
);
