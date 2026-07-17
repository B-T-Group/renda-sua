-- Async thumbnails for item_variant_images: add s3_key + lifecycle columns + display_url

ALTER TABLE public.item_variant_images
    ADD COLUMN s3_key TEXT,
    ADD COLUMN thumbnail TEXT,
    ADD COLUMN thumbnail_s3_key TEXT,
    ADD COLUMN thumbnail_status public.image_thumb_status NOT NULL DEFAULT 'pending',
    ADD COLUMN thumbnail_width INTEGER,
    ADD COLUMN thumbnail_height INTEGER,
    ADD COLUMN thumbnail_format TEXT,
    ADD COLUMN thumbnail_bytes INTEGER,
    ADD COLUMN thumbnail_generated_at TIMESTAMPTZ,
    ADD COLUMN thumbnail_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN thumbnail_last_attempt_at TIMESTAMPTZ,
    ADD COLUMN thumbnail_error TEXT;

ALTER TABLE public.item_variant_images
    ADD COLUMN display_url TEXT
    GENERATED ALWAYS AS (
        CASE
            WHEN thumbnail_status = 'ready' AND thumbnail IS NOT NULL THEN thumbnail
            ELSE image_url
        END
    ) STORED;

CREATE INDEX idx_item_variant_images_thumbnail_status_pending
    ON public.item_variant_images (thumbnail_status, created_at)
    WHERE thumbnail_status IN ('pending', 'failed');

COMMENT ON COLUMN public.item_variant_images.thumbnail IS 'Public URL of the generated list thumbnail (WebP, max edge 400px)';
COMMENT ON COLUMN public.item_variant_images.display_url IS 'Generated: thumbnail when ready, else original image_url';
