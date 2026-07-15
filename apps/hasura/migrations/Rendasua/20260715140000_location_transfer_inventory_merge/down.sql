DROP INDEX IF EXISTS public.idx_bltr_to_business_location;

ALTER TABLE public.business_location_transfer_requests
    DROP CONSTRAINT IF EXISTS business_location_transfer_merge_requires_dest_location;

ALTER TABLE public.business_location_transfer_requests
    DROP COLUMN IF EXISTS to_business_location_id,
    DROP COLUMN IF EXISTS transfer_mode;

DROP TYPE IF EXISTS public.business_location_transfer_mode;
