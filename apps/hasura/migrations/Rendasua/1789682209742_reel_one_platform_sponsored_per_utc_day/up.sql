-- At most one non-deleted, non-failed platform-sponsored reel per UTC calendar day.
-- Failed attempts free the slot so the cron can retry the same day.
DROP INDEX IF EXISTS public.reels_one_platform_sponsored_per_utc_day_idx;

CREATE UNIQUE INDEX IF NOT EXISTS reels_one_platform_sponsored_per_utc_day_idx
  ON public.reels ((timezone('UTC', created_at)::date))
  WHERE platform_sponsored = true
    AND deleted_at IS NULL
    AND processing_status IS DISTINCT FROM 'failed';
