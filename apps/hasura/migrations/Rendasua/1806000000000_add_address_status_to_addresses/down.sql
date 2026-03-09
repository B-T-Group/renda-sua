-- Remove status column and enum type from addresses
ALTER TABLE public.addresses
DROP COLUMN IF EXISTS status;

DROP TYPE IF EXISTS address_status_enum;

