DO $t$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_image_status_enum') THEN
        CREATE TYPE public.business_image_status_enum AS ENUM ('unassigned', 'assigned', 'archived');
    END IF;
END
$t$;

CREATE TABLE public.business_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    sub_category_id INTEGER,
    image_url TEXT NOT NULL,
    s3_key TEXT,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format TEXT,
    caption TEXT,
    alt_text TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    status public.business_image_status_enum NOT NULL DEFAULT 'unassigned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_ai_cleaned BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_business_images_business FOREIGN KEY (business_id)
        REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_business_images_sub_category FOREIGN KEY (sub_category_id)
        REFERENCES public.item_sub_categories(id) ON UPDATE RESTRICT ON DELETE SET NULL
);

CREATE INDEX idx_business_images_business_id_created_at
    ON public.business_images (business_id, created_at DESC);

CREATE INDEX idx_business_images_sub_category
    ON public.business_images (sub_category_id);

CREATE INDEX idx_business_images_tags_gin
    ON public.business_images USING GIN (tags);
