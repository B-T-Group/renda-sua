DROP TABLE IF EXISTS public.rental_listing_ai_proposed_images;
DROP TABLE IF EXISTS public.rental_listing_ai_reviews;

DROP TYPE IF EXISTS public.rental_listing_ai_override_action;
DROP TYPE IF EXISTS public.rental_listing_ai_admin_feedback;
DROP TYPE IF EXISTS public.rental_listing_ai_review_status;

ALTER TABLE public.rental_location_listings
  DROP COLUMN IF EXISTS moderation_source,
  DROP COLUMN IF EXISTS ai_review_version,
  DROP COLUMN IF EXISTS ai_reviewed_at;

-- Enum values ai_reviewing / proposal_pending cannot be removed safely in Postgres.
