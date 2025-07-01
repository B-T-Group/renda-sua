-- Add unique index on address_id column for business_locations table
CREATE UNIQUE INDEX IF NOT EXISTS business_locations_address_id_unique_idx ON public.business_locations (address_id);
