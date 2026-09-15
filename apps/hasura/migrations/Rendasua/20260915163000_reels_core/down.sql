DROP TABLE IF EXISTS public.reel_view_events;
DROP TABLE IF EXISTS public.reel_likes;
DROP TABLE IF EXISTS public.reels;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS reels_enabled_allowlist;
DROP TYPE IF EXISTS public.reel_generation_source;
DROP TYPE IF EXISTS public.reel_processing_status;
DROP TYPE IF EXISTS public.reel_moderation_status;
