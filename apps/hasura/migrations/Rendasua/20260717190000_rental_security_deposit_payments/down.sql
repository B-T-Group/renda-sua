DROP INDEX IF EXISTS public.idx_rental_bookings_end_reminder;

ALTER TABLE public.rental_bookings
    DROP COLUMN IF EXISTS end_reminder_sent_at,
    DROP COLUMN IF EXISTS payment_status,
    DROP COLUMN IF EXISTS payment_timing,
    DROP COLUMN IF EXISTS overtime_amount,
    DROP COLUMN IF EXISTS captured_amount,
    DROP COLUMN IF EXISTS authorized_amount,
    DROP COLUMN IF EXISTS security_deposit_amount;

ALTER TABLE public.rental_location_listings
    DROP CONSTRAINT IF EXISTS rental_location_listings_security_deposit_check,
    DROP COLUMN IF EXISTS security_deposit_amount;

DROP TYPE IF EXISTS public.rental_booking_payment_status_enum;
DROP TYPE IF EXISTS public.rental_payment_timing_enum;

-- Note: the 'reserved' value added to rental_booking_status_enum cannot be
-- removed (PostgreSQL does not support dropping enum values).
