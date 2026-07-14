CREATE OR REPLACE FUNCTION public.accept_business_location_transfer(
    p_request_id UUID,
    p_destination_business_id UUID
)
RETURNS SETOF public.business_location_transfer_requests
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    transfer_request public.business_location_transfer_requests%ROWTYPE;
    location_row public.business_locations%ROWTYPE;
    item_ids UUID[];
    rental_item_ids UUID[];
    listing_ids UUID[];
    transfer_time TIMESTAMPTZ;
BEGIN
    LOCK TABLE
        public.business_locations,
        public.business_addresses,
        public.business_inventory,
        public.items,
        public.item_images,
        public.rental_items,
        public.rental_item_images,
        public.rental_location_listings,
        public.orders,
        public.order_refund_requests,
        public.rental_bookings,
        public.accounts,
        public.business_item_favorites
    IN SHARE ROW EXCLUSIVE MODE;

    SELECT *
    INTO transfer_request
    FROM public.business_location_transfer_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TRANSFER_REQUEST_NOT_FOUND';
    END IF;
    transfer_time := clock_timestamp();
    IF transfer_request.status <> 'pending'
       OR transfer_request.expires_at <= transfer_time THEN
        RAISE EXCEPTION 'TRANSFER_REQUEST_NOT_PENDING';
    END IF;
    IF transfer_request.to_business_id <> p_destination_business_id THEN
        RAISE EXCEPTION 'TRANSFER_DESTINATION_MISMATCH';
    END IF;

    SELECT *
    INTO location_row
    FROM public.business_locations
    WHERE id = transfer_request.business_location_id
    FOR UPDATE;

    IF NOT FOUND
       OR location_row.business_id <> transfer_request.from_business_id THEN
        RAISE EXCEPTION 'TRANSFER_LOCATION_OWNERSHIP_CHANGED';
    END IF;

    SELECT COALESCE(array_agg(DISTINCT item_id), ARRAY[]::UUID[])
    INTO item_ids
    FROM public.business_inventory
    WHERE business_location_id = location_row.id;

    SELECT
        COALESCE(array_agg(DISTINCT rental_item_id), ARRAY[]::UUID[]),
        COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO rental_item_ids, listing_ids
    FROM public.rental_location_listings
    WHERE business_location_id = location_row.id;

    IF location_row.is_primary
       OR (
           SELECT count(*)
           FROM public.business_locations
           WHERE business_id = transfer_request.from_business_id
       ) <= 1 THEN
        RAISE EXCEPTION 'TRANSFER_BLOCKED_SOURCE_LOCATION';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.business_inventory
        WHERE item_id = ANY(item_ids)
          AND business_location_id <> location_row.id
    ) OR EXISTS (
        SELECT 1
        FROM public.rental_location_listings
        WHERE rental_item_id = ANY(rental_item_ids)
          AND business_location_id <> location_row.id
    ) THEN
        RAISE EXCEPTION 'TRANSFER_BLOCKED_SHARED_CATALOG';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.items source_item
        JOIN public.items destination_item
          ON destination_item.sku = source_item.sku
        WHERE source_item.id = ANY(item_ids)
          AND source_item.sku IS NOT NULL
          AND destination_item.business_id = transfer_request.to_business_id
    ) THEN
        RAISE EXCEPTION 'TRANSFER_BLOCKED_SKU_COLLISION';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.orders
        WHERE business_location_id = location_row.id
          AND current_status NOT IN (
              'delivered'::public.order_status,
              'complete'::public.order_status,
              'cancelled'::public.order_status,
              'failed'::public.order_status,
              'refunded'::public.order_status
          )
    ) THEN
        RAISE EXCEPTION 'TRANSFER_BLOCKED_ONGOING_ORDERS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.rental_bookings
        WHERE rental_location_listing_id = ANY(listing_ids)
          AND status IN (
              'confirmed'::public.rental_booking_status_enum,
              'active'::public.rental_booking_status_enum,
              'awaiting_return'::public.rental_booking_status_enum,
              'proposed'::public.rental_booking_status_enum
          )
    ) THEN
        RAISE EXCEPTION 'TRANSFER_BLOCKED_ONGOING_RENTALS';
    END IF;

    UPDATE public.business_location_transfer_requests
    SET status = 'accepted', responded_at = transfer_time
    WHERE id = transfer_request.id;

    UPDATE public.business_locations
    SET business_id = transfer_request.to_business_id, is_primary = FALSE
    WHERE id = location_row.id;

    UPDATE public.business_addresses
    SET business_id = transfer_request.to_business_id
    WHERE address_id = location_row.address_id;

    UPDATE public.items
    SET business_id = transfer_request.to_business_id
    WHERE id = ANY(item_ids);

    UPDATE public.item_images
    SET business_id = transfer_request.to_business_id
    WHERE item_id = ANY(item_ids);

    UPDATE public.rental_items
    SET business_id = transfer_request.to_business_id
    WHERE id = ANY(rental_item_ids);

    UPDATE public.rental_item_images
    SET business_id = transfer_request.to_business_id
    WHERE rental_item_id = ANY(rental_item_ids);

    UPDATE public.orders
    SET business_id = transfer_request.to_business_id
    WHERE business_location_id = location_row.id;

    UPDATE public.order_refund_requests
    SET business_id = transfer_request.to_business_id
    WHERE order_id IN (
        SELECT id
        FROM public.orders
        WHERE business_location_id = location_row.id
    );

    UPDATE public.rental_bookings
    SET business_id = transfer_request.to_business_id
    WHERE rental_location_listing_id = ANY(listing_ids);

    UPDATE public.accounts
    SET user_id = transfer_request.to_user_id
    WHERE business_location_id = location_row.id;

    DELETE FROM public.business_item_favorites
    WHERE item_id = ANY(item_ids)
      AND business_id = transfer_request.from_business_id;

    RETURN QUERY
    SELECT *
    FROM public.business_location_transfer_requests
    WHERE id = transfer_request.id;
END;
$$;

COMMENT ON FUNCTION public.accept_business_location_transfer(UUID, UUID)
IS 'Atomically claims a pending location transfer request and reassigns all location-owned records.';
