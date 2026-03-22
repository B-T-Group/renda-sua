DELETE FROM public.rental_item_images WHERE rental_item_id IS NULL;

ALTER TABLE public.rental_item_images DROP CONSTRAINT IF EXISTS fk_rental_item_images_rental_item;

ALTER TABLE public.rental_item_images
    ALTER COLUMN rental_item_id SET NOT NULL;

ALTER TABLE public.rental_item_images
    ADD CONSTRAINT rental_item_images_rental_item_id_fkey
    FOREIGN KEY (rental_item_id)
    REFERENCES public.rental_items(id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE;

ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS is_ai_cleaned;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS status;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS tags;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS caption;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS format;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS height;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS width;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS file_size;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS s3_key;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS rental_category_id;
ALTER TABLE public.rental_item_images DROP COLUMN IF EXISTS business_id;

DROP INDEX IF EXISTS idx_rental_item_images_rental_category;
DROP INDEX IF EXISTS idx_rental_item_images_tags_gin;
DROP INDEX IF EXISTS idx_rental_item_images_business_created;

DROP TYPE IF EXISTS public.rental_item_image_status_enum;
