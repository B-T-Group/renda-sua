-- Staging uploads use {env}/rental-inspection/pending/{booking}/{media}.ext.
-- A ready or locked row cannot point at a pending key.

ALTER TABLE public.rental_inspection_media
  DROP CONSTRAINT IF EXISTS rental_inspection_media_key_check;

ALTER TABLE public.rental_inspection_media
  ADD CONSTRAINT rental_inspection_media_key_check CHECK (
    object_key ~ '^(dev|prod)/rental-inspection/(pending/)?[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    AND (
      status = 'pending'
      OR object_key !~ '/pending/'
    )
  );
