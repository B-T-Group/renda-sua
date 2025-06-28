-- Create image_type enum
CREATE TYPE public.image_type_enum AS ENUM ('main', 'thumbnail', 'detail', 'gallery', 'angle');

-- Create item_images table
CREATE TABLE public.item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    image_type image_type_enum DEFAULT 'gallery',
    alt_text TEXT,
    caption TEXT,
    display_order INTEGER DEFAULT 0,
    file_size INTEGER, -- file size in bytes
    width INTEGER, -- image width in pixels
    height INTEGER, -- image height in pixels
    format TEXT, -- jpg, png, webp, etc.
    uploaded_by UUID, -- FK to users.id (optional)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_item_images_item FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_item_images_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT unique_item_main_image UNIQUE (item_id, image_type) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for better performance
CREATE INDEX idx_item_images_item_id ON public.item_images(item_id);
CREATE INDEX idx_item_images_display_order ON public.item_images(display_order);
CREATE INDEX idx_item_images_active ON public.item_images(is_active);
CREATE INDEX idx_item_images_type ON public.item_images(image_type);

-- Create or replace the updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at column
CREATE TRIGGER set_public_item_images_updated_at
    BEFORE UPDATE ON public.item_images
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_public_item_images_updated_at ON public.item_images
    IS 'trigger to set value of column "updated_at" to current timestamp on row update';
