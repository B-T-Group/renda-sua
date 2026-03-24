-- Item image library: business-scoped rows, optional item_id (like rental_item_images).
-- Migrates data from business_images into item_images.

-- 1) Add library columns (business_id nullable until backfill)
ALTER TABLE public.item_images
    ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE;

UPDATE public.item_images ii
SET business_id = i.business_id
FROM public.items i
WHERE ii.item_id = i.id
  AND i.business_id IS NOT NULL;

-- Orphan rows (no item), items missing business_id, or other gaps cannot get business_id; drop them so NOT NULL succeeds.
DELETE FROM public.item_images
WHERE business_id IS NULL;

ALTER TABLE public.item_images
    ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE public.item_images
    ADD COLUMN item_sub_category_id INTEGER REFERENCES public.item_sub_categories(id) ON UPDATE RESTRICT ON DELETE SET NULL;

ALTER TABLE public.item_images
    ADD COLUMN s3_key TEXT;

ALTER TABLE public.item_images
    ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.item_images
    ADD COLUMN status public.business_image_status_enum NOT NULL DEFAULT 'assigned';

ALTER TABLE public.item_images
    ADD COLUMN is_ai_cleaned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.item_images
    ADD COLUMN migrated_from_business_image_id UUID;

UPDATE public.item_images
SET status = 'assigned'
WHERE item_id IS NOT NULL;

-- 2) Allow library rows: nullable item_id; when set, must reference items (ON DELETE RESTRICT)
ALTER TABLE public.item_images
    DROP CONSTRAINT IF EXISTS unique_item_main_image;

ALTER TABLE public.item_images
    DROP CONSTRAINT IF EXISTS fk_item_images_item;

ALTER TABLE public.item_images
    ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE public.item_images
    ADD CONSTRAINT fk_item_images_item
    FOREIGN KEY (item_id)
    REFERENCES public.items(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX uniq_item_images_one_main_per_item
    ON public.item_images (item_id)
    WHERE item_id IS NOT NULL AND image_type = 'main'::public.image_type_enum;

CREATE INDEX idx_item_images_business_created
    ON public.item_images (business_id, created_at DESC);

CREATE INDEX idx_item_images_tags_gin
    ON public.item_images USING GIN (tags);

CREATE INDEX idx_item_images_item_sub_category
    ON public.item_images (item_sub_category_id);

COMMENT ON COLUMN public.item_images.business_id IS 'Owner business; required even when item_id is null (library)';
COMMENT ON COLUMN public.item_images.item_id IS 'Null in library only; when set, must reference public.items (FK ON DELETE RESTRICT)';
COMMENT ON COLUMN public.item_images.is_ai_cleaned IS 'True when the displayed image was replaced after AI cleanup';
COMMENT ON COLUMN public.item_images.migrated_from_business_image_id IS 'Set during migration from business_images; not a FK';

-- 3) Copy business_images -> item_images (per sku-resolved item, else one library row)
DO $$
DECLARE
    r RECORD;
    tag TEXT;
    sku_suffix TEXT;
    matched_item_id UUID;
    ins_count INT;
    new_status public.business_image_status_enum;
BEGIN
    FOR r IN
        SELECT
            id,
            business_id,
            sub_category_id,
            image_url,
            s3_key,
            file_size,
            width,
            height,
            format,
            caption,
            alt_text,
            tags,
            status,
            is_ai_cleaned,
            created_at
        FROM public.business_images
    LOOP
        ins_count := 0;
        IF r.tags IS NOT NULL THEN
            FOREACH tag IN ARRAY r.tags
            LOOP
                IF tag IS NULL OR lower(tag) NOT LIKE 'sku:%' THEN
                    CONTINUE;
                END IF;
                sku_suffix := lower(trim(both from substring(tag FROM 5)));
                IF sku_suffix = '' THEN
                    CONTINUE;
                END IF;
                SELECT i.id INTO matched_item_id
                FROM public.items i
                WHERE i.business_id = r.business_id
                  AND i.sku IS NOT NULL
                  AND lower(trim(both from i.sku)) = sku_suffix
                LIMIT 1;
                IF matched_item_id IS NULL THEN
                    CONTINUE;
                END IF;
                IF EXISTS (
                    SELECT 1
                    FROM public.item_images ii
                    WHERE ii.item_id = matched_item_id
                      AND ii.image_url = r.image_url
                ) THEN
                    CONTINUE;
                END IF;
                IF r.status = 'archived'::public.business_image_status_enum THEN
                    new_status := 'archived'::public.business_image_status_enum;
                ELSE
                    new_status := 'assigned'::public.business_image_status_enum;
                END IF;
                INSERT INTO public.item_images (
                    business_id,
                    item_id,
                    item_sub_category_id,
                    image_url,
                    s3_key,
                    file_size,
                    width,
                    height,
                    format,
                    caption,
                    alt_text,
                    tags,
                    status,
                    is_ai_cleaned,
                    created_at,
                    updated_at,
                    image_type,
                    display_order,
                    is_active,
                    migrated_from_business_image_id
                ) VALUES (
                    r.business_id,
                    matched_item_id,
                    r.sub_category_id,
                    r.image_url,
                    r.s3_key,
                    r.file_size,
                    r.width,
                    r.height,
                    r.format,
                    r.caption,
                    r.alt_text,
                    COALESCE(r.tags, '{}'),
                    new_status,
                    COALESCE(r.is_ai_cleaned, FALSE),
                    r.created_at,
                    r.created_at,
                    'gallery'::public.image_type_enum,
                    (SELECT COALESCE(MAX(ii.display_order), -1) + 1 FROM public.item_images ii WHERE ii.item_id = matched_item_id),
                    TRUE,
                    r.id
                );
                ins_count := ins_count + 1;
            END LOOP;
        END IF;

        IF ins_count = 0 THEN
            IF EXISTS (
                SELECT 1
                FROM public.item_images ii
                WHERE ii.migrated_from_business_image_id = r.id
            ) THEN
                CONTINUE;
            END IF;
            IF r.status = 'archived'::public.business_image_status_enum THEN
                new_status := 'archived'::public.business_image_status_enum;
            ELSE
                new_status := 'unassigned'::public.business_image_status_enum;
            END IF;
            INSERT INTO public.item_images (
                business_id,
                item_id,
                item_sub_category_id,
                image_url,
                s3_key,
                file_size,
                width,
                height,
                format,
                caption,
                alt_text,
                tags,
                status,
                is_ai_cleaned,
                created_at,
                updated_at,
                image_type,
                display_order,
                is_active,
                migrated_from_business_image_id
            ) VALUES (
                r.business_id,
                NULL,
                r.sub_category_id,
                r.image_url,
                r.s3_key,
                r.file_size,
                r.width,
                r.height,
                r.format,
                r.caption,
                r.alt_text,
                COALESCE(r.tags, '{}'),
                new_status,
                COALESCE(r.is_ai_cleaned, FALSE),
                r.created_at,
                r.created_at,
                'gallery'::public.image_type_enum,
                0,
                TRUE,
                r.id
            );
        END IF;
    END LOOP;
END $$;
