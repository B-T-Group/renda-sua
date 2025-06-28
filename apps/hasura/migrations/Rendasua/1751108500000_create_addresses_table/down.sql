-- Drop trigger first
DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_addresses_entity;
DROP INDEX IF EXISTS idx_addresses_primary;
DROP INDEX IF EXISTS idx_addresses_location;

-- Drop table
DROP TABLE IF EXISTS public.addresses;

-- Drop enum
DROP TYPE IF EXISTS entity_type_enum; 