-- Reverse only the CI/CD rows this migration would have added for export_available items.
-- Does not remove CI/CD rows that may have been set intentionally before this migration.

DELETE FROM public.item_export_markets e
WHERE e.country_code IN ('CI', 'CD')
  AND EXISTS (
    SELECT 1
    FROM public.items i
    WHERE i.id = e.item_id
      AND i.export_available = true
  );
