-- Remove backfilled destination markets from this migration only.
-- Leaves CM/GA/PH (and any other) rows that predated this migration.

DELETE FROM public.item_export_markets e
USING public.items i
WHERE e.item_id = i.id
  AND i.export_available = true
  AND e.country_code IN ('CI', 'TG', 'CG');
