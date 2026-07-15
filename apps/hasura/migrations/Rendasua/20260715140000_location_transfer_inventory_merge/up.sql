-- Inventory-merge mode for business location transfers
CREATE TYPE public.business_location_transfer_mode AS ENUM (
    'location_ownership',
    'inventory_merge'
);

ALTER TABLE public.business_location_transfer_requests
    ADD COLUMN transfer_mode public.business_location_transfer_mode
        NOT NULL DEFAULT 'location_ownership',
    ADD COLUMN to_business_location_id UUID
        REFERENCES public.business_locations(id) ON UPDATE RESTRICT ON DELETE SET NULL;

ALTER TABLE public.business_location_transfer_requests
    ADD CONSTRAINT business_location_transfer_merge_requires_dest_location
    CHECK (
        (transfer_mode = 'location_ownership' AND to_business_location_id IS NULL)
        OR
        (transfer_mode = 'inventory_merge' AND to_business_location_id IS NOT NULL)
    );

CREATE INDEX idx_bltr_to_business_location
    ON public.business_location_transfer_requests (to_business_location_id)
    WHERE to_business_location_id IS NOT NULL;

COMMENT ON COLUMN public.business_location_transfer_requests.transfer_mode IS
'location_ownership moves the location to the destination business; inventory_merge moves exclusive non-duplicate catalog/inventory into an existing destination location.';
COMMENT ON COLUMN public.business_location_transfer_requests.to_business_location_id IS
'Required for inventory_merge: destination location that receives stock.';
