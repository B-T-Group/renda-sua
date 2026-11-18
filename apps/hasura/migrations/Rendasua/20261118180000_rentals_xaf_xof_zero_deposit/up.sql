-- XAF and XOF listings have no card deposit. Clear any stored amount, including the old 8× hourly default.
-- currency is public.currency_enum. Compare it directly: btrim has no enum overload.
-- Idempotent: a second run matches no rows once the amounts are already 0.
-- The updated_at trigger stays off for this statement so catalog order (updated_at desc) does not change.
-- Must run inside a transaction. With --no-transaction, a failure between DISABLE and ENABLE
-- leaves set_public_rental_location_listings_updated_at disabled.

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.rental_location_listings
  DISABLE TRIGGER set_public_rental_location_listings_updated_at;

UPDATE public.rental_location_listings AS listing
SET security_deposit_amount = 0
FROM public.rental_items AS item
WHERE listing.rental_item_id = item.id
  AND item.currency IN ('XAF', 'XOF')
  AND listing.security_deposit_amount <> 0;

ALTER TABLE public.rental_location_listings
  ENABLE TRIGGER set_public_rental_location_listings_updated_at;
