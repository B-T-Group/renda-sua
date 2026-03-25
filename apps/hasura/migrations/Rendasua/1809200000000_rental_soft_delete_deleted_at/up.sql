-- Soft delete support for rental catalog (listing + item)

ALTER TABLE public.rental_items
  ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE public.rental_location_listings
  ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_rental_items_deleted_at_null
  ON public.rental_items (id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_rental_location_listings_deleted_at_null
  ON public.rental_location_listings (id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.rental_items.deleted_at IS 'When set, item is soft-deleted and hidden from catalog';
COMMENT ON COLUMN public.rental_location_listings.deleted_at IS 'When set, listing is soft-deleted and hidden from catalog';
