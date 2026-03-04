-- Add image_cleanup_enabled to businesses (only superuser business accounts can enable this for others)
ALTER TABLE public.businesses
ADD COLUMN image_cleanup_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.businesses.image_cleanup_enabled IS 'When true, this business can use the AI image cleanup feature. Only business admins can enable this for a business.';
