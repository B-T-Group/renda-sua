-- AI auto-review for rental location listings

ALTER TYPE public.rental_listing_moderation_status ADD VALUE IF NOT EXISTS 'ai_reviewing';
ALTER TYPE public.rental_listing_moderation_status ADD VALUE IF NOT EXISTS 'proposal_pending';

ALTER TABLE public.rental_location_listings
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ai_review_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moderation_source text NULL;

COMMENT ON COLUMN public.rental_location_listings.moderation_source IS
  'Who last decided: ai | admin | business_accept';

CREATE TYPE public.rental_listing_ai_review_status AS ENUM (
  'running',
  'approved',
  'proposal',
  'rejected',
  'failed'
);

CREATE TYPE public.rental_listing_ai_admin_feedback AS ENUM (
  'agree',
  'disagree'
);

CREATE TYPE public.rental_listing_ai_override_action AS ENUM (
  'none',
  'force_approve',
  'force_reject',
  'force_requeue'
);

CREATE TABLE public.rental_listing_ai_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.rental_location_listings(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  status public.rental_listing_ai_review_status NOT NULL DEFAULT 'running',
  decision_reason text NULL,
  alignment_score numeric NULL,
  rubric jsonb NULL,
  input_snapshot jsonb NULL,
  raw_model_response jsonb NULL,
  proposed_title text NULL,
  proposed_description text NULL,
  rejection_fields text[] NOT NULL DEFAULT '{}',
  model_meta jsonb NULL,
  prompt_version text NOT NULL DEFAULT 'rental-ai-review-v1',
  review_version integer NOT NULL DEFAULT 0,
  admin_feedback public.rental_listing_ai_admin_feedback NULL,
  admin_feedback_notes text NULL,
  admin_feedback_by_user_id uuid NULL REFERENCES public.users(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  admin_feedback_at timestamptz NULL,
  admin_override_action public.rental_listing_ai_override_action NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX idx_rental_listing_ai_reviews_listing_created
  ON public.rental_listing_ai_reviews (listing_id, created_at DESC);

CREATE INDEX idx_rental_listing_ai_reviews_status_created
  ON public.rental_listing_ai_reviews (status, created_at DESC);

CREATE INDEX idx_rental_listing_ai_reviews_prompt_version
  ON public.rental_listing_ai_reviews (prompt_version);

CREATE TABLE public.rental_listing_ai_proposed_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.rental_listing_ai_reviews(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  source_image_id uuid NULL REFERENCES public.rental_item_images(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  image_url text NOT NULL,
  s3_key text NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rental_listing_ai_proposed_images_review
  ON public.rental_listing_ai_proposed_images (review_id, display_order);
