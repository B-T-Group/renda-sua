-- Renter report that an inspected item was not handed over.
-- One row per booking. It does not change status, payment, or inspection resolution.
-- The flag inserts false. Dev Hasura apply turns that global row on.
-- Production apply does not.

CREATE TABLE IF NOT EXISTS public.rental_not_received_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  reported_by_user_id uuid NOT NULL REFERENCES public.users(id),
  reported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rental_not_received_reports_booking_uidx UNIQUE (rental_booking_id)
);

COMMENT ON TABLE public.rental_not_received_reports IS
  'Renter says the item was not received. Support and the business are notified. No refund, cancel, or status change.';

CREATE INDEX IF NOT EXISTS rental_not_received_reports_reported_idx
  ON public.rental_not_received_reports (reported_at DESC);

INSERT INTO public.message_types (id, comment)
VALUES (
  'RENTAL_NOT_RECEIVED',
  'The renter says they have not received the rental item'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_not_received_report_enabled',
  'Report item not received',
  'Renter can report an inspected rental was not handed over, for 30 minutes after start. Notifies support and the business. No refund or status change. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_not_received_report_enabled' AND country_code IS NULL
);
