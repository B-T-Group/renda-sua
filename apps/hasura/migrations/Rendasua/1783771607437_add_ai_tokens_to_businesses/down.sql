ALTER TABLE public.businesses
  ADD COLUMN image_cleanup_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.businesses.image_cleanup_enabled IS
  'When true, this business can use the AI image cleanup feature. Only business admins can enable this for a business.';

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS ai_tokens;
