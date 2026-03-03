-- Drop indexes
DROP INDEX IF EXISTS idx_business_images_tags_gin;
DROP INDEX IF EXISTS idx_business_images_sub_category;
DROP INDEX IF EXISTS idx_business_images_business_id_created_at;

-- Drop table
DROP TABLE IF EXISTS public.business_images;

-- Drop enum type
DROP TYPE IF EXISTS public.business_image_status_enum;

