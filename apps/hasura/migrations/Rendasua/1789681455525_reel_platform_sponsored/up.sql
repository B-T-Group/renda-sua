-- Platform-sponsored AI reels (daily auto-generate cron)

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS platform_sponsored boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS reels_platform_sponsored_created_idx
  ON public.reels (platform_sponsored, created_at)
  WHERE platform_sponsored = true;
