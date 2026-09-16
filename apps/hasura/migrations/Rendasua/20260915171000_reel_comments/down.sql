ALTER TABLE public.reels DROP COLUMN IF EXISTS comment_count;
DROP TABLE IF EXISTS public.reel_comments;
DROP TYPE IF EXISTS public.reel_comment_moderation_status;
