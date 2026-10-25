DROP FUNCTION IF EXISTS public.settle_ai_cleanup_tokens(uuid, uuid, integer, text);
DROP FUNCTION IF EXISTS public.reserve_ai_tokens(uuid, integer);

ALTER TABLE public.ai_image_cleanup_jobs
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_jobs_nongiftable_reserved_nonneg;
ALTER TABLE public.ai_image_cleanup_jobs
  DROP COLUMN IF EXISTS nongiftable_reserved;

DROP TABLE IF EXISTS public.ai_token_hold_results;
