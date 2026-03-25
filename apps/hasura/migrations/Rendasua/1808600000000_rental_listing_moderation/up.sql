-- Moderation lifecycle for rental catalog listings (public visibility requires approved)
CREATE TYPE public.rental_listing_moderation_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

ALTER TABLE public.rental_location_listings
  ADD COLUMN moderation_status public.rental_listing_moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN moderated_at timestamptz NULL,
  ADD COLUMN moderated_by_user_id uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;

UPDATE public.rental_location_listings
SET moderation_status = 'approved'
WHERE moderation_status = 'pending';

INSERT INTO public.entity_types (id, comment)
VALUES ('rental_listing', 'Rental listing messages')
ON CONFLICT (id) DO NOTHING;
