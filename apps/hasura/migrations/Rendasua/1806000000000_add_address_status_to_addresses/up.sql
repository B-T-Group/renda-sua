-- Add status enum and column to addresses for soft delete support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'address_status_enum'
  ) THEN
    CREATE TYPE address_status_enum AS ENUM ('active', 'deleted');
  END IF;
END;
$$;

ALTER TABLE public.addresses
ADD COLUMN status address_status_enum NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_addresses_status
ON public.addresses (status);

