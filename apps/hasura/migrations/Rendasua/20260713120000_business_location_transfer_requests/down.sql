DROP TRIGGER IF EXISTS trigger_update_business_location_transfer_requests_updated_at
    ON public.business_location_transfer_requests;
DROP FUNCTION IF EXISTS update_business_location_transfer_requests_updated_at();
DROP TABLE IF EXISTS public.business_location_transfer_requests;
DROP TYPE IF EXISTS public.business_location_transfer_status;
