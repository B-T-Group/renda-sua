-- Ensure every export_available item has destination market rows so they
-- appear in export rails/search after interest_only → export_available rename.
-- Idempotent; safe if consolidate-export-catalog already seeded rows.

INSERT INTO public.item_export_markets (item_id, country_code)
SELECT i.id, m.country_code
FROM public.items i
CROSS JOIN (VALUES ('CM'), ('GA'), ('PH')) AS m(country_code)
WHERE i.export_available = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.item_export_markets e
    WHERE e.item_id = i.id
      AND e.country_code = m.country_code
  )
  AND NOT EXISTS (
    -- Skip destination = home listing country when inventory address is known
    SELECT 1
    FROM public.business_inventory bi
    JOIN public.business_locations bl ON bl.id = bi.business_location_id
    JOIN public.addresses a ON a.id = bl.address_id
    WHERE bi.item_id = i.id
      AND bi.is_active = true
      AND upper(a.country) = m.country_code
  );
