-- Deactivate every pickup-decline flag row, including country rows. Do not delete them.
UPDATE public.application_configurations
SET boolean_value = false,
    status = 'inactive'
WHERE config_key = 'rentals_pickup_decline_enabled';

DROP VIEW IF EXISTS public.rental_business_pickup_reach_90d;
DROP VIEW IF EXISTS public.rental_condition_decline_counts_90d;

DROP TABLE IF EXISTS public.rental_condition_decline_photos;
DROP TABLE IF EXISTS public.rental_condition_declines;

ALTER TABLE public.rental_bookings
  DROP CONSTRAINT IF EXISTS rental_bookings_refund_status_check;

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS refund_provider_ref,
  DROP COLUMN IF EXISTS refund_provider,
  DROP COLUMN IF EXISTS refund_currency,
  DROP COLUMN IF EXISTS refund_amount,
  DROP COLUMN IF EXISTS refunded_at,
  DROP COLUMN IF EXISTS refund_status_at,
  DROP COLUMN IF EXISTS refund_requested_at,
  DROP COLUMN IF EXISTS refund_status,
  DROP COLUMN IF EXISTS condition_declined_at;
