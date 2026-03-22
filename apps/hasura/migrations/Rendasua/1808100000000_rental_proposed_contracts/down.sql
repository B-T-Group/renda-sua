ALTER TABLE public.rental_requests DROP COLUMN IF EXISTS unavailable_reason_code;
ALTER TABLE public.rental_bookings DROP COLUMN IF EXISTS contract_expires_at;
-- Cannot remove enum value proposed safely in PG without recreating type; leave enum value in down migration omitted
