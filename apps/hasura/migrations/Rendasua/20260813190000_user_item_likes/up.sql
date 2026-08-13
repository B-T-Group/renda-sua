-- Shopper likes / wishlist (one like per user per catalog item)
CREATE TABLE public.user_item_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_item_likes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT user_item_likes_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT user_item_likes_user_id_item_id_key UNIQUE (user_id, item_id)
);

CREATE INDEX user_item_likes_user_id_created_at_idx
  ON public.user_item_likes (user_id, created_at DESC);

CREATE INDEX user_item_likes_item_id_idx
  ON public.user_item_likes (item_id);

COMMENT ON TABLE public.user_item_likes IS
  'Shopper likes / wishlist entries keyed by user and catalog item';

-- Cached like count on catalog products for efficient display/sorting
ALTER TABLE public.items
  ADD COLUMN likes_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.items.likes_count IS
  'Cached count of rows in user_item_likes for this item';

-- Keep likes_count in sync on insert/delete
CREATE OR REPLACE FUNCTION public.update_item_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.items
    SET likes_count = likes_count + 1
    WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.items
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_item_likes_count
  AFTER INSERT OR DELETE ON public.user_item_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_item_likes_count();
