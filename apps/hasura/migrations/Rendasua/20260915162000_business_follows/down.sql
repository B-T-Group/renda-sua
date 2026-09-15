DROP TRIGGER IF EXISTS trigger_update_business_followers_count ON public.business_follows;
DROP FUNCTION IF EXISTS public.update_business_followers_count();
ALTER TABLE public.businesses DROP COLUMN IF EXISTS followers_count;
DROP TABLE IF EXISTS public.business_follows;
