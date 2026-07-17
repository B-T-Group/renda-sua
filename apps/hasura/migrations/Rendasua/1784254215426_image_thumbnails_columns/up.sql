-- Async thumbnail generation: lifecycle columns + display_url,
-- and removal of the legacy 'thumbnail' gallery role from image_type_enum.

-- 1) Reassign legacy 'thumbnail' role rows to 'gallery'
UPDATE public.item_images
SET image_type = 'gallery'::public.image_type_enum
WHERE image_type = 'thumbnail'::public.image_type_enum;

-- 2) Replace image_type_enum without 'thumbnail'
-- (the partial unique index predicate depends on the enum type, so drop/recreate it)
DROP INDEX IF EXISTS public.uniq_item_images_one_main_per_item;
DROP INDEX IF EXISTS public.idx_item_images_type;

CREATE TYPE public.image_type_enum_new AS ENUM ('main', 'detail', 'gallery', 'angle');

ALTER TABLE public.item_images
    ALTER COLUMN image_type DROP DEFAULT;

ALTER TABLE public.item_images
    ALTER COLUMN image_type TYPE public.image_type_enum_new
    USING (image_type::text::public.image_type_enum_new);

ALTER TABLE public.item_images
    ALTER COLUMN image_type SET DEFAULT 'gallery'::public.image_type_enum_new;

DROP TYPE public.image_type_enum;
ALTER TYPE public.image_type_enum_new RENAME TO image_type_enum;

CREATE UNIQUE INDEX uniq_item_images_one_main_per_item
    ON public.item_images (item_id)
    WHERE item_id IS NOT NULL AND image_type = 'main'::public.image_type_enum;

CREATE INDEX idx_item_images_type ON public.item_images (image_type);

-- 3) Thumbnail generation lifecycle status
CREATE TYPE public.image_thumb_status AS ENUM (
    'pending',
    'processing',
    'ready',
    'failed',
    'skipped'
);

-- 4) item_images: thumbnail columns + display_url + backfill index
ALTER TABLE public.item_images
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

ALTER TABLE public.item_images
    ADD COLUMN display_url TEXT
    GENERATED ALWAYS AS (
        CASE
            WHEN thumbnail_status = 'ready' AND thumbnail IS NOT NULL THEN thumbnail
            ELSE image_url
        END
    ) STORED;

CREATE INDEX idx_item_images_thumbnail_status_pending
    ON public.item_images (thumbnail_status, created_at)
    WHERE thumbnail_status IN ('pending', 'failed');

COMMENT ON COLUMN public.item_images.thumbnail IS 'Public URL of the generated list thumbnail (WebP, max edge 400px)';
COMMENT ON COLUMN public.item_images.thumbnail_status IS 'Async thumbnail generation lifecycle: pending/processing/ready/failed/skipped';
COMMENT ON COLUMN public.item_images.display_url IS 'Generated: thumbnail when ready, else original image_url';

-- 5) rental_item_images: same columns
ALTER TABLE public.rental_item_images
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

ALTER TABLE public.rental_item_images
    ADD COLUMN display_url TEXT
    GENERATED ALWAYS AS (
        CASE
            WHEN thumbnail_status = 'ready' AND thumbnail IS NOT NULL THEN thumbnail
            ELSE image_url
        END
    ) STORED;

CREATE INDEX idx_rental_item_images_thumbnail_status_pending
    ON public.rental_item_images (thumbnail_status, created_at)
    WHERE thumbnail_status IN ('pending', 'failed');

COMMENT ON COLUMN public.rental_item_images.thumbnail IS 'Public URL of the generated list thumbnail (WebP, max edge 400px)';
COMMENT ON COLUMN public.rental_item_images.thumbnail_status IS 'Async thumbnail generation lifecycle: pending/processing/ready/failed/skipped';
COMMENT ON COLUMN public.rental_item_images.display_url IS 'Generated: thumbnail when ready, else original image_url';

-- 6) Existing rows are historical until backfilled; mark them pending explicitly (default already does this)
