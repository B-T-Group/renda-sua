-- ONE-OFF RESET (writes). Run on DEV first; do NOT run on prod without Samuel's approval.
-- Puts cron-written coordinates back to "pending" so the hardened cron re-evaluates them
-- (rows that fail the new street-level / non-partial rules become not_found with a reason
-- and keep NULL coordinates).
--
-- Safety:
--  * Only rows with geocode_status = 'success' (the cron is the only writer of that column).
--  * Skips rows a user/admin edited after the cron wrote them (updated_at moved later), so
--    hand-corrected coordinates are kept.
--  * Backs the touched rows up first; restore snippet at the bottom.
--  * Single transaction.
--
-- Step 1: preview the count (read only):
--   SELECT count(*) FROM addresses a WHERE a.geocode_status = 'success'
--     AND a.updated_at <= a.geocode_attempted_at + interval '1 minute';

BEGIN;

CREATE TABLE IF NOT EXISTS public.addresses_geocode_reset_backup_20261009 AS
SELECT a.id, a.latitude, a.longitude, a.geocode_status, a.geocode_reason,
       a.geocode_attempted_at, a.updated_at, now() AS backed_up_at
FROM public.addresses a
WHERE a.geocode_status = 'success'
  AND a.updated_at <= a.geocode_attempted_at + interval '1 minute';

UPDATE public.addresses a
SET latitude = NULL,
    longitude = NULL,
    geocode_status = NULL,
    geocode_reason = NULL,
    geocode_attempted_at = NULL
FROM public.addresses_geocode_reset_backup_20261009 b
WHERE a.id = b.id
  AND a.geocode_status = 'success';

-- Review the row count reported above, then COMMIT (or ROLLBACK).
COMMIT;

-- Restore (only if needed):
--   UPDATE public.addresses a SET latitude = b.latitude, longitude = b.longitude,
--     geocode_status = b.geocode_status, geocode_reason = b.geocode_reason,
--     geocode_attempted_at = b.geocode_attempted_at
--   FROM public.addresses_geocode_reset_backup_20261009 b WHERE a.id = b.id;
--   -- then: DROP TABLE public.addresses_geocode_reset_backup_20261009;
