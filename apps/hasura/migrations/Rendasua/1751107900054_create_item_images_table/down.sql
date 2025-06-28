-- Drop the trigger first
DROP TRIGGER IF EXISTS set_public_item_images_updated_at ON public.item_images;

-- Drop the item_images table
DROP TABLE IF EXISTS public.item_images;

-- Drop the enum type
DROP TYPE IF EXISTS public.image_type_enum;
