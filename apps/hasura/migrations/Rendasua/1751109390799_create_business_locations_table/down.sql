-- Drop trigger first
DROP TRIGGER IF EXISTS set_public_business_locations_updated_at ON public.business_locations;

-- Drop table
DROP TABLE IF EXISTS public.business_locations;

-- Drop enum
DROP TYPE IF EXISTS public.location_type_enum;
