-- Business location transfer requests (employee onboarding handoff → destination accept/reject)
CREATE TYPE public.business_location_transfer_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'cancelled',
    'expired'
);

CREATE TABLE public.business_location_transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_location_id UUID NOT NULL
        REFERENCES public.business_locations(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    from_business_id UUID NOT NULL
        REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    to_business_id UUID NOT NULL
        REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    from_user_id UUID NOT NULL
        REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    to_user_id UUID NOT NULL
        REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    requested_by_user_id UUID NOT NULL
        REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    status public.business_location_transfer_status NOT NULL DEFAULT 'pending',
    item_count INTEGER NOT NULL DEFAULT 0,
    rental_item_count INTEGER NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT business_location_transfer_distinct_businesses
        CHECK (from_business_id <> to_business_id)
);

CREATE UNIQUE INDEX business_location_transfer_one_pending_per_location
    ON public.business_location_transfer_requests (business_location_id)
    WHERE status = 'pending';

CREATE INDEX idx_bltr_to_business_status
    ON public.business_location_transfer_requests (to_business_id, status);
CREATE INDEX idx_bltr_from_business_status
    ON public.business_location_transfer_requests (from_business_id, status);
CREATE INDEX idx_bltr_status_expires
    ON public.business_location_transfer_requests (status, expires_at);
CREATE INDEX idx_bltr_created_at
    ON public.business_location_transfer_requests (created_at DESC);

CREATE OR REPLACE FUNCTION update_business_location_transfer_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_business_location_transfer_requests_updated_at
    BEFORE UPDATE ON public.business_location_transfer_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_business_location_transfer_requests_updated_at();

COMMENT ON TABLE public.business_location_transfer_requests IS
'Pending and historical ownership transfer requests for business locations. Accept executes atomic reassignment; completed rows are the audit history.';
COMMENT ON COLUMN public.business_location_transfer_requests.expires_at IS
'Timestamp after which a pending request can no longer be accepted (default 7 days).';
