-- Draft lifecycle: new listings start as draft; publish moves to pending (+ AI review)
-- Requires 'draft' enum value from 20260710210000 (committed in a prior migration).

ALTER TABLE public.rental_location_listings
  ALTER COLUMN moderation_status SET DEFAULT 'draft';

COMMENT ON COLUMN public.rental_location_listings.moderation_status IS
  'draft = unsubmitted; pending/ai_reviewing/proposal_pending/approved/rejected = review pipeline';
