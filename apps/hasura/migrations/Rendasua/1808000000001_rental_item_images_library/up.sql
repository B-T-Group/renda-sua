-- Rental item image library: optional rental_item_id, business-scoped, AI cleanup flag

CREATE TYPE public.rental_item_image_status_enum AS ENUM (
    'unassigned',
    'assigned',
    'archived'
);

ALTER TABLE public.rental_item_images
    ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE;

UPDATE public.rental_item_images rii
SET business_id = ri.business_id
FROM public.rental_items ri
WHERE rii.rental_item_id = ri.id;

ALTER TABLE public.rental_item_images
    ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE public.rental_item_images
    DROP CONSTRAINT IF EXISTS rental_item_images_rental_item_id_fkey;

ALTER TABLE public.rental_item_images
    ALTER COLUMN rental_item_id DROP NOT NULL;

ALTER TABLE public.rental_item_images
    ADD CONSTRAINT fk_rental_item_images_rental_item
    FOREIGN KEY (rental_item_id)
    REFERENCES public.rental_items(id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL;

ALTER TABLE public.rental_item_images
    ADD COLUMN rental_category_id UUID REFERENCES public.rental_categories(id) ON UPDATE RESTRICT ON DELETE SET NULL;

ALTER TABLE public.rental_item_images
    ADD COLUMN s3_key TEXT;

ALTER TABLE public.rental_item_images
    ADD COLUMN file_size INTEGER;

ALTER TABLE public.rental_item_images
    ADD COLUMN width INTEGER;

ALTER TABLE public.rental_item_images
    ADD COLUMN height INTEGER;

ALTER TABLE public.rental_item_images
    ADD COLUMN format TEXT;

ALTER TABLE public.rental_item_images
    ADD COLUMN caption TEXT;

ALTER TABLE public.rental_item_images
    ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.rental_item_images
    ADD COLUMN status public.rental_item_image_status_enum NOT NULL DEFAULT 'unassigned';

ALTER TABLE public.rental_item_images
    ADD COLUMN is_ai_cleaned BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.rental_item_images
SET status = 'assigned'
WHERE rental_item_id IS NOT NULL;

CREATE INDEX idx_rental_item_images_business_created
    ON public.rental_item_images (business_id, created_at DESC);

CREATE INDEX idx_rental_item_images_tags_gin
    ON public.rental_item_images USING GIN (tags);

CREATE INDEX idx_rental_item_images_rental_category
    ON public.rental_item_images (rental_category_id);

COMMENT ON COLUMN public.rental_item_images.business_id IS 'Owner business; required even when rental_item_id is null (library)';
COMMENT ON COLUMN public.rental_item_images.rental_item_id IS 'Null while image is only in the library; set when attached to a rental item';
COMMENT ON COLUMN public.rental_item_images.is_ai_cleaned IS 'True when the displayed image was replaced after AI cleanup';
