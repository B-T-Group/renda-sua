-- Remove rows created from business_images migration
DELETE FROM public.item_images
WHERE migrated_from_business_image_id IS NOT NULL;

ALTER TABLE public.item_images
    DROP COLUMN IF EXISTS migrated_from_business_image_id;

DROP INDEX IF EXISTS idx_item_images_item_sub_category;
DROP INDEX IF EXISTS idx_item_images_tags_gin;
DROP INDEX IF EXISTS idx_item_images_business_created;
DROP INDEX IF EXISTS uniq_item_images_one_main_per_item;

ALTER TABLE public.item_images
    DROP CONSTRAINT IF EXISTS fk_item_images_item;

-- Fail down if orphan library rows exist
ALTER TABLE public.item_images
    ALTER COLUMN item_id SET NOT NULL;

ALTER TABLE public.item_images
    ADD CONSTRAINT fk_item_images_item
    FOREIGN KEY (item_id)
    REFERENCES public.items(id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE;

ALTER TABLE public.item_images
    ADD CONSTRAINT unique_item_main_image
    UNIQUE (item_id, image_type)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.item_images DROP COLUMN IF EXISTS is_ai_cleaned;
ALTER TABLE public.item_images DROP COLUMN IF EXISTS status;
ALTER TABLE public.item_images DROP COLUMN IF EXISTS tags;
ALTER TABLE public.item_images DROP COLUMN IF EXISTS s3_key;
ALTER TABLE public.item_images DROP COLUMN IF EXISTS item_sub_category_id;
ALTER TABLE public.item_images DROP COLUMN IF EXISTS business_id;
