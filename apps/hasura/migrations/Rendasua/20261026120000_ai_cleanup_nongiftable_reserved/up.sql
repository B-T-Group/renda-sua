-- Free tokens held by an open image-cleanup job.
-- Failure refunds use this so signup tokens are not returned as giftable.

ALTER TABLE public.ai_image_cleanup_jobs
  ADD COLUMN IF NOT EXISTS nongiftable_reserved integer NOT NULL DEFAULT 0;

ALTER TABLE public.ai_image_cleanup_jobs
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_jobs_nongiftable_reserved_nonneg;

ALTER TABLE public.ai_image_cleanup_jobs
  ADD CONSTRAINT ai_image_cleanup_jobs_nongiftable_reserved_nonneg
  CHECK (nongiftable_reserved >= 0);

COMMENT ON COLUMN public.ai_image_cleanup_jobs.nongiftable_reserved IS
  'Signup/free AI tokens still held by this job. Spent first; refunded after purchased tokens.';
