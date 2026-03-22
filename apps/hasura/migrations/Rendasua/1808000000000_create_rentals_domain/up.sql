-- Rentals domain: business-operated rentals (v1)

CREATE TYPE public.rental_operation_mode_enum AS ENUM ('business_operated');

CREATE TYPE public.rental_request_status_enum AS ENUM (
    'pending',
    'available',
    'unavailable',
    'booked',
    'expired',
    'cancelled'
);

CREATE TYPE public.rental_booking_status_enum AS ENUM (
    'confirmed',
    'active',
    'awaiting_return',
    'completed',
    'cancelled'
);

CREATE TYPE public.rental_hold_status_enum AS ENUM (
    'active',
    'cancelled',
    'completed'
);

CREATE TABLE public.rental_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_public_rental_categories_updated_at
    BEFORE UPDATE ON public.rental_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.rental_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    rental_category_id UUID NOT NULL REFERENCES public.rental_categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    currency public.currency_enum NOT NULL DEFAULT 'XAF',
    operation_mode public.rental_operation_mode_enum NOT NULL DEFAULT 'business_operated',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rental_items_operation_mode_v1 CHECK (operation_mode = 'business_operated')
);

CREATE INDEX idx_rental_items_business ON public.rental_items(business_id);
CREATE INDEX idx_rental_items_category ON public.rental_items(rental_category_id);
CREATE INDEX idx_rental_items_active ON public.rental_items(is_active);
CREATE INDEX idx_rental_items_tags ON public.rental_items USING GIN (tags);

CREATE TRIGGER set_public_rental_items_updated_at
    BEFORE UPDATE ON public.rental_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.rental_item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_item_id UUID NOT NULL REFERENCES public.rental_items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rental_item_images_item ON public.rental_item_images(rental_item_id);

CREATE TRIGGER set_public_rental_item_images_updated_at
    BEFORE UPDATE ON public.rental_item_images
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.rental_location_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_item_id UUID NOT NULL REFERENCES public.rental_items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    business_location_id UUID NOT NULL REFERENCES public.business_locations(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    pickup_instructions TEXT NOT NULL DEFAULT '',
    dropoff_instructions TEXT NOT NULL DEFAULT '',
    base_price_per_day NUMERIC(18, 2) NOT NULL,
    min_rental_days INTEGER NOT NULL DEFAULT 1,
    max_rental_days INTEGER,
    units_available INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rental_location_listings_units_check CHECK (units_available >= 1),
    CONSTRAINT rental_location_listings_min_max_days CHECK (
        max_rental_days IS NULL OR max_rental_days >= min_rental_days
    ),
    CONSTRAINT rental_location_listings_unique_location_item UNIQUE (rental_item_id, business_location_id)
);

CREATE INDEX idx_rental_location_listings_location ON public.rental_location_listings(business_location_id);
CREATE INDEX idx_rental_location_listings_active ON public.rental_location_listings(is_active);

CREATE TRIGGER set_public_rental_location_listings_updated_at
    BEFORE UPDATE ON public.rental_location_listings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.rental_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    rental_location_listing_id UUID NOT NULL REFERENCES public.rental_location_listings(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    requested_start_at TIMESTAMPTZ NOT NULL,
    requested_end_at TIMESTAMPTZ NOT NULL,
    status public.rental_request_status_enum NOT NULL DEFAULT 'pending',
    rental_pricing_snapshot JSONB,
    business_response_note TEXT,
    responded_at TIMESTAMPTZ,
    responded_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rental_requests_time_order CHECK (requested_end_at > requested_start_at),
    CONSTRAINT rental_requests_available_requires_snapshot CHECK (
        status IS DISTINCT FROM 'available'::public.rental_request_status_enum
        OR rental_pricing_snapshot IS NOT NULL
    )
);

CREATE INDEX idx_rental_requests_client ON public.rental_requests(client_id);
CREATE INDEX idx_rental_requests_listing ON public.rental_requests(rental_location_listing_id);
CREATE INDEX idx_rental_requests_status ON public.rental_requests(status);

CREATE TRIGGER set_public_rental_requests_updated_at
    BEFORE UPDATE ON public.rental_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.rental_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_request_id UUID NOT NULL UNIQUE REFERENCES public.rental_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    rental_location_listing_id UUID NOT NULL REFERENCES public.rental_location_listings(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    total_amount NUMERIC(18, 2) NOT NULL,
    currency public.currency_enum NOT NULL,
    rental_pricing_snapshot JSONB NOT NULL,
    status public.rental_booking_status_enum NOT NULL DEFAULT 'confirmed',
    rental_start_pin_hash TEXT,
    rental_start_pin_attempts INTEGER NOT NULL DEFAULT 0,
    rental_start_overwrite_code_hash TEXT,
    rental_start_overwrite_code_used_at TIMESTAMPTZ,
    period_ended_notified_at TIMESTAMPTZ,
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rental_bookings_time_order CHECK (end_at > start_at)
);

CREATE INDEX idx_rental_bookings_client ON public.rental_bookings(client_id);
CREATE INDEX idx_rental_bookings_business ON public.rental_bookings(business_id);
CREATE INDEX idx_rental_bookings_status_end ON public.rental_bookings(status, end_at);

CREATE TRIGGER set_public_rental_bookings_updated_at
    BEFORE UPDATE ON public.rental_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.rental_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id UUID NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    client_hold_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    currency public.currency_enum NOT NULL,
    status public.rental_hold_status_enum NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rental_holds_amount_check CHECK (client_hold_amount >= 0),
    CONSTRAINT rental_holds_unique_booking UNIQUE (rental_booking_id)
);

CREATE INDEX idx_rental_holds_client ON public.rental_holds(client_id);
CREATE INDEX idx_rental_holds_status ON public.rental_holds(status);

CREATE TRIGGER set_public_rental_holds_updated_at
    BEFORE UPDATE ON public.rental_holds
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.rental_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_booking_id UUID NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
    status public.rental_booking_status_enum NOT NULL,
    previous_status public.rental_booking_status_enum,
    changed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    changed_by_type VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rental_status_history_changed_by_type_check CHECK (
        changed_by_type IN ('client', 'business', 'agent', 'system')
    )
);

CREATE INDEX idx_rental_status_history_booking ON public.rental_status_history(rental_booking_id);
CREATE INDEX idx_rental_status_history_created ON public.rental_status_history(created_at);

INSERT INTO public.rental_categories (id, name, slug, display_order, is_active)
VALUES
    ('a0000001-0001-4000-8000-000000000001', 'Vehicles', 'vehicles', 1, true),
    ('a0000001-0001-4000-8000-000000000002', 'Equipment', 'equipment', 2, true),
    ('a0000001-0001-4000-8000-000000000003', 'Events', 'events', 3, true),
    ('a0000001-0001-4000-8000-000000000004', 'Other', 'other', 4, true);

COMMENT ON TABLE public.rental_items IS 'Business-operated rental catalog items (v1: business_operated only)';
COMMENT ON COLUMN public.rental_requests.rental_pricing_snapshot IS 'Required when status is available; JSON pricing contract from business';
COMMENT ON COLUMN public.rental_bookings.rental_pricing_snapshot IS 'Copy of pricing snapshot at booking time';
