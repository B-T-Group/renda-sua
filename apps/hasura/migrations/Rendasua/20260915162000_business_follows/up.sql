CREATE TABLE public.business_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_follows_user_business_unique UNIQUE (user_id, business_id)
);

CREATE INDEX business_follows_user_id_created_at_idx
  ON public.business_follows (user_id, created_at DESC);

CREATE INDEX business_follows_business_id_idx
  ON public.business_follows (business_id);

ALTER TABLE public.businesses
  ADD COLUMN followers_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.businesses.followers_count IS
  'Cached count of business_follows rows for this business';

CREATE OR REPLACE FUNCTION public.update_business_followers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.businesses
    SET followers_count = followers_count + 1
    WHERE id = NEW.business_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.businesses
    SET followers_count = GREATEST(followers_count - 1, 0)
    WHERE id = OLD.business_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_business_followers_count
  AFTER INSERT OR DELETE ON public.business_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_followers_count();
