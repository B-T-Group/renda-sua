-- Revert async thumbnail columns and restore 'thumbnail' in image_type_enum

-- 1) rental_item_images: drop columns + index
DROP INDEX IF EXISTS public.idx_rental_item_images_thumbnail_status_pending;

ALTER TABLE public.rental_item_images
    DROP COLUMN IF EXISTS display_url,
    DROP COLUMN IF EXISTS thumbnail_error,
    DROP COLUMN IF EXISTS thumbnail_last_attempt_at,
    DROP COLUMN IF EXISTS thumbnail_attempts,
    DROP COLUMN IF EXISTS thumbnail_generated_at,
    DROP COLUMN IF EXISTS thumbnail_bytes,
    DROP COLUMN IF EXISTS thumbnail_format,
    DROP COLUMN IF EXISTS thumbnail_height,
    DROP COLUMN IF EXISTS thumbnail_width,
    DROP COLUMN IF EXISTS thumbnail_status,
    DROP COLUMN IF EXISTS thumbnail_s3_key,
    DROP COLUMN IF EXISTS thumbnail;

-- 2) item_images: drop columns + index
DROP INDEX IF EXISTS public.idx_item_images_thumbnail_status_pending;

ALTER TABLE public.item_images
    DROP COLUMN IF EXISTS display_url,
    DROP COLUMN IF EXISTS thumbnail_error,
    DROP COLUMN IF EXISTS thumbnail_last_attempt_at,
    DROP COLUMN IF EXISTS thumbnail_attempts,
    DROP COLUMN IF EXISTS thumbnail_generated_at,
    DROP COLUMN IF EXISTS thumbnail_bytes,
    DROP COLUMN IF EXISTS thumbnail_format,
    DROP COLUMN IF EXISTS thumbnail_height,
    DROP COLUMN IF EXISTS thumbnail_width,
    DROP COLUMN IF EXISTS thumbnail_status,
    DROP COLUMN IF EXISTS thumbnail_s3_key,
    DROP COLUMN IF EXISTS thumbnail;

DROP TYPE IF EXISTS public.image_thumb_status;

-- 3) Restore image_type_enum with 'thumbnail'
DROP INDEX IF EXISTS public.uniq_item_images_one_main_per_item;
DROP INDEX IF EXISTS public.idx_item_images_type;

CREATE TYPE public.image_type_enum_old AS ENUM ('main', 'thumbnail', 'detail', 'gallery', 'angle');

ALTER TABLE public.item_images
    ALTER COLUMN image_type DROP DEFAULT;

ALTER TABLE public.item_images
    ALTER COLUMN image_type TYPE public.image_type_enum_old
    USING (image_type::text::public.image_type_enum_old);

ALTER TABLE public.item_images
    ALTER COLUMN image_type SET DEFAULT 'gallery'::public.image_type_enum_old;

DROP TYPE public.image_type_enum;
ALTER TYPE public.image_type_enum_old RENAME TO image_type_enum;

CREATE UNIQUE INDEX uniq_item_images_one_main_per_item
    ON public.item_images (item_id)
    WHERE item_id IS NOT NULL AND image_type = 'main'::public.image_type_enum;

CREATE INDEX idx_item_images_type ON public.item_images (image_type);
