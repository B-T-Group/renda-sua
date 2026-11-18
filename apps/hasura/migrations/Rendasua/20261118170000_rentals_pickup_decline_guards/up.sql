-- One decline per booking, a real inspection version, and refund retry state.
-- The earlier migration allowed one row per version. That let a second version refund again.

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

COMMENT ON TABLE public.rental_condition_declines IS
  'Renter rejected the pickup condition. One row per booking. A repeat is the same decline.';

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS refund_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_next_at timestamptz;

COMMENT ON COLUMN public.rental_bookings.refund_attempts IS
  'Poll and retry count for a condition-decline Mobile Money refund. Support is flagged at 5.';
