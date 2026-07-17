-- Rental security deposit, deferred pickup payment (wallet / mobile money),
-- and Stripe authorize-then-capture support.

-- New booking status for capacity-holding, unpaid reservations (pay at pickup).
ALTER TYPE public.rental_booking_status_enum ADD VALUE IF NOT EXISTS 'reserved';

CREATE TYPE public.rental_payment_timing_enum AS ENUM ('pay_now', 'pay_at_pickup');

CREATE TYPE public.rental_booking_payment_status_enum AS ENUM (
    'pending',
    'authorized',
    'paid',
    'cancelled'
);

ALTER TABLE public.rental_location_listings
    ADD COLUMN IF NOT EXISTS security_deposit_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT rental_location_listings_security_deposit_check
        CHECK (security_deposit_amount >= 0);

-- Backfill existing listings with the default deposit (8x hourly rate).
UPDATE public.rental_location_listings
SET security_deposit_amount = ROUND(base_price_per_hour * 8, 2)
WHERE security_deposit_amount = 0;

ALTER TABLE public.rental_bookings
    ADD COLUMN IF NOT EXISTS security_deposit_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS authorized_amount NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS captured_amount NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(18, 2),
    ADD COLUMN IF NOT EXISTS payment_timing public.rental_payment_timing_enum NOT NULL DEFAULT 'pay_now',
    ADD COLUMN IF NOT EXISTS payment_status public.rental_booking_payment_status_enum NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS end_reminder_sent_at TIMESTAMPTZ;

-- Backfill payment status from booking status for existing rows.
UPDATE public.rental_bookings
SET payment_status = CASE
    WHEN status IN ('confirmed', 'active', 'awaiting_return', 'completed')
        THEN 'paid'::public.rental_booking_payment_status_enum
    WHEN status = 'cancelled'
        THEN 'cancelled'::public.rental_booking_payment_status_enum
    ELSE 'pending'::public.rental_booking_payment_status_enum
END;

CREATE INDEX IF NOT EXISTS idx_rental_bookings_end_reminder
    ON public.rental_bookings (end_at)
    WHERE end_reminder_sent_at IS NULL;

COMMENT ON COLUMN public.rental_location_listings.security_deposit_amount IS
    'Security deposit charged/authorized on top of the rental total; defaults to 8x base_price_per_hour';
COMMENT ON COLUMN public.rental_bookings.security_deposit_amount IS
    'Snapshot of the listing security deposit at contract time';
COMMENT ON COLUMN public.rental_bookings.authorized_amount IS
    'Stripe rail: contract total + security deposit authorized (manual capture)';
COMMENT ON COLUMN public.rental_bookings.captured_amount IS
    'Stripe rail: final amount captured at return (contract + overtime, capped by authorization)';
COMMENT ON COLUMN public.rental_bookings.overtime_amount IS
    'Amount owed for hours used past the booked end time (charged from deposit on Stripe)';
COMMENT ON COLUMN public.rental_bookings.payment_timing IS
    'pay_now (Stripe authorize at booking) or pay_at_pickup (wallet / mobile money collected at handoff)';
COMMENT ON COLUMN public.rental_bookings.end_reminder_sent_at IS
    'Set when the 30-minutes-before-end reminder was sent (idempotency)';
