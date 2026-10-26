ALTER TABLE public.ai_image_cleanup_jobs
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_jobs_nongiftable_reserved_nonneg;

ALTER TABLE public.ai_image_cleanup_jobs
  DROP COLUMN IF EXISTS nongiftable_reserved;
