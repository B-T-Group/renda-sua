ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS reels_deleted_at_idx ON public.reels (deleted_at)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS public.reels_feed_idx;
CREATE INDEX reels_feed_idx ON public.reels (market_country, published_at DESC)
  WHERE moderation_status = 'approved'
    AND processing_status = 'ready'
    AND is_active = true
    AND deleted_at IS NULL;
