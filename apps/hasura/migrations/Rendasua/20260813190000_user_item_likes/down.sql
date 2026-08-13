DROP TRIGGER IF EXISTS trigger_update_item_likes_count ON public.user_item_likes;
DROP FUNCTION IF EXISTS public.update_item_likes_count();

ALTER TABLE public.items DROP COLUMN IF EXISTS likes_count;

DROP TABLE IF EXISTS public.user_item_likes;
