-- Ensure Canada export catalog is visible in African destination markets:
-- CM (Cameroon), CI (Côte d'Ivoire), TG (Togo), CG (Congo), GA (Gabon).
-- Idempotent. Keeps existing PH rows. Skips home-country matches.

INSERT INTO public.item_export_markets (item_id, country_code)
SELECT i.id, m.country_code
FROM public.items i
CROSS JOIN (VALUES ('CM'), ('CI'), ('TG'), ('CG'), ('GA')) AS m(country_code)
WHERE i.export_available = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.item_export_markets e
    WHERE e.item_id = i.id
      AND e.country_code = m.country_code
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_inventory bi
    JOIN public.business_locations bl ON bl.id = bi.business_location_id
    JOIN public.addresses a ON a.id = bl.address_id
    WHERE bi.item_id = i.id
      AND bi.is_active = true
      AND upper(a.country) = m.country_code
  );
