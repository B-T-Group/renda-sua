-- Deactivate every pickup-decline flag row, including country rows. Do not delete them.
UPDATE public.application_configurations
SET boolean_value = false,
    status = 'inactive'
WHERE config_key = 'rentals_pickup_decline_enabled';

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS refund_next_at,
  DROP COLUMN IF EXISTS refund_attempts;

ALTER TABLE public.rental_condition_declines
  DROP CONSTRAINT IF EXISTS rental_condition_declines_version_fkey;

ALTER TABLE public.rental_condition_declines
  DROP CONSTRAINT IF EXISTS rental_condition_declines_booking_uidx;

ALTER TABLE public.rental_condition_declines
  ADD CONSTRAINT rental_condition_declines_booking_version_uidx UNIQUE (rental_booking_id, version_id);
