-- NOT VALID: rows staged under pending/ by the newer backend must not block a rollback.
-- New and updated rows are still checked against the old key shape.
ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_key_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_key_check CHECK (
    object_key ~ '^(dev|prod)/rental-inspection/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ) NOT VALID;
