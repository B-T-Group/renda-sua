DROP INDEX IF EXISTS public.reels_feed_idx;
CREATE INDEX reels_feed_idx ON public.reels (market_country, published_at DESC)
  WHERE moderation_status = 'approved' AND processing_status = 'ready';

ALTER TABLE public.reels DROP COLUMN IF EXISTS is_active;
