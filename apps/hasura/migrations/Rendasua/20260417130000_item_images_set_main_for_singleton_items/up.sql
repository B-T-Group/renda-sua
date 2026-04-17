-- Data migration: items with exactly one linked row in item_images get that row
-- marked as the primary catalog image. The enum value is 'main' (no 'primary' value exists).

UPDATE public.item_images ii
SET image_type = 'main'::public.image_type_enum
FROM (
  SELECT item_id
  FROM public.item_images
  WHERE item_id IS NOT NULL
  GROUP BY item_id
  HAVING COUNT(*) = 1
) AS lone (item_id)
WHERE ii.item_id = lone.item_id
  AND ii.image_type IS DISTINCT FROM 'main'::public.image_type_enum;
