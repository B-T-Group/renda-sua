DROP INDEX IF EXISTS public.reels_platform_sponsored_created_idx;

ALTER TABLE public.reels
  DROP COLUMN IF EXISTS platform_sponsored;
