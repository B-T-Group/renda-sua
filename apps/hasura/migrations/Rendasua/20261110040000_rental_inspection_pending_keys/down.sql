ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_key_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_key_check CHECK (
    object_key ~ '^(dev|prod)/rental-inspection/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  );
