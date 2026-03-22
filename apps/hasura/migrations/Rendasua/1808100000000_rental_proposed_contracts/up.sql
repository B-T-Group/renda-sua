-- Proposed rental contracts: booking row before client confirms; structured unavailable reasons

ALTER TYPE public.rental_booking_status_enum ADD VALUE 'proposed';

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS contract_expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.rental_bookings.contract_expires_at IS 'When status is proposed, client must confirm before this time';

ALTER TABLE public.rental_requests
  ADD COLUMN IF NOT EXISTS unavailable_reason_code TEXT NULL;

COMMENT ON COLUMN public.rental_requests.unavailable_reason_code IS 'Business reason when status is unavailable (e.g. fully_booked, other)';
