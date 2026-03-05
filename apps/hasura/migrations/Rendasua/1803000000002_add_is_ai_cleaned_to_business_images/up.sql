-- Add is_ai_cleaned to track images cleaned with AI
ALTER TABLE public.business_images
    ADD COLUMN is_ai_cleaned BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.business_images.is_ai_cleaned IS 'True when the image was cleaned using the AI cleanup feature';
