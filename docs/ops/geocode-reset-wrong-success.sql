-- ONE-OFF RESET (writes). Run on DEV first; do NOT run on prod without Samuel's approval.
-- Run docs/ops/geocode-wrong-success-list.sql first and check the rows with would_reset = true.
--
-- Resets ONLY rows that (a) the old cron marked 'success', (b) the NEW cron can refill:
-- active, client-linked, NOT business / agent / business-location / order-linked, and
-- (c) whose address text fails the new text rules (the gibberish rows), and
-- (d) were not edited after the cron wrote them.
-- Business, agent, order-linked, soft-deleted and unlinked rows are NEVER touched: the new
-- cron would not refill them, so resetting would lose their coordinates permanently.
-- Every touched row is backed up first; single transaction; restore snippet at the bottom.
--
-- Dry run (read only): the SELECT inside the CREATE TABLE below, run on its own, returns the rows.

BEGIN;

CREATE TABLE IF NOT EXISTS public.addresses_geocode_reset_backup_20261009 AS
SELECT a.id, a.latitude, a.longitude, a.geocode_status, a.geocode_reason,
       a.geocode_attempted_at, a.updated_at, now() AS backed_up_at
FROM public.addresses a
WHERE a.geocode_status = 'success'
  AND a.status = 'active'
  AND a.updated_at <= a.geocode_attempted_at + interval '1 minute'
  AND EXISTS (SELECT 1 FROM public.client_addresses c WHERE c.address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.business_addresses b WHERE b.address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.business_locations bl WHERE bl.address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.agent_addresses g WHERE g.address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.delivery_address_id = a.id)
  AND (char_length(btrim(a.address_line_1)) < 5
       OR (SELECT count(*) FROM regexp_matches(a.address_line_1, '[[:alpha:]]', 'g')) < 3
       OR char_length(btrim(a.city)) < 2);

UPDATE public.addresses a
SET latitude = NULL,
    longitude = NULL,
    geocode_status = NULL,
    geocode_reason = NULL,
    geocode_attempted_at = NULL
FROM public.addresses_geocode_reset_backup_20261009 b
WHERE a.id = b.id
  AND a.geocode_status = 'success';

-- Check the row count, then COMMIT (or ROLLBACK).
COMMIT;

-- Restore (only if needed):
--   UPDATE public.addresses a SET latitude = b.latitude, longitude = b.longitude,
--     geocode_status = b.geocode_status, geocode_reason = b.geocode_reason,
--     geocode_attempted_at = b.geocode_attempted_at
--   FROM public.addresses_geocode_reset_backup_20261009 b WHERE a.id = b.id;
--   -- then: DROP TABLE public.addresses_geocode_reset_backup_20261009;
