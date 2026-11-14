-- Renter says the item is back. One timestamp per booking.
-- It does not change status, release the deposit, settle, or close the rental.
-- The flag inserts false. Dev is turned on by hand. Production stays off.

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS renter_reported_returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS renter_return_escalated_at timestamptz;

COMMENT ON COLUMN public.rental_bookings.renter_reported_returned_at IS
  'When the renter reported the item handed back. Does not complete the booking or release the deposit.';

COMMENT ON COLUMN public.rental_bookings.renter_return_escalated_at IS
  'When support was told the business had not confirmed within 24 hours. Set once.';

CREATE INDEX IF NOT EXISTS rental_bookings_return_report_escalation_idx
  ON public.rental_bookings (renter_reported_returned_at)
  WHERE renter_reported_returned_at IS NOT NULL
    AND renter_return_escalated_at IS NULL;

INSERT INTO public.message_types (id, comment)
VALUES (
  'RENTAL_RENTER_RETURN_REPORTED',
  'The renter says the rental item is back. The business still confirms the return.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_renter_return_report_enabled',
  'Renter return report',
  'Renter can tell the business an item is back. Does not change status or release the deposit. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_renter_return_report_enabled' AND country_code IS NULL
);
