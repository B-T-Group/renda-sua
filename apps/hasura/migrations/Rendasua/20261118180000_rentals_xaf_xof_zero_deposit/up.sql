-- XAF and XOF listings have no card deposit. Clear any stored amount, including the old 8× hourly default.
-- Idempotent: a second run matches no rows once the amounts are already 0.

UPDATE public.rental_location_listings AS listing
SET security_deposit_amount = 0
FROM public.rental_items AS item
WHERE listing.rental_item_id = item.id
  AND upper(btrim(item.currency)) IN ('XAF', 'XOF')
  AND listing.security_deposit_amount <> 0;
