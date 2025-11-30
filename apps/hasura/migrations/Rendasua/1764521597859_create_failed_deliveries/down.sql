-- Drop trigger
DROP TRIGGER IF EXISTS set_public_failed_deliveries_updated_at ON public.failed_deliveries;

-- Drop table
DROP TABLE IF EXISTS public.failed_deliveries;

-- Drop enums
DROP TYPE IF EXISTS public.failed_delivery_resolution_type_enum;
DROP TYPE IF EXISTS public.failed_delivery_status_enum;

