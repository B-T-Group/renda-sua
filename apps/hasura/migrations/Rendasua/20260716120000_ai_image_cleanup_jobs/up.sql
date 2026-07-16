-- Async AI image cleanup jobs (merchant opt-in after item create)

CREATE TYPE public.ai_image_cleanup_job_status AS ENUM (
  'queued',
  'processing',
  'ready_for_review',
  'failed',
  'completed',
  'cancelled'
);

CREATE TYPE public.ai_image_cleanup_result_status AS ENUM (
  'queued',
  'processing',
  'ready',
  'accepted',
  'rejected',
  'failed'
);

CREATE TABLE public.ai_image_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  requested_by_user_id uuid NULL REFERENCES public.users(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  status public.ai_image_cleanup_job_status NOT NULL DEFAULT 'queued',
  tokens_reserved integer NOT NULL DEFAULT 0,
  tokens_consumed integer NOT NULL DEFAULT 0,
  tokens_refunded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX idx_ai_image_cleanup_jobs_business_status
  ON public.ai_image_cleanup_jobs (business_id, status);

CREATE INDEX idx_ai_image_cleanup_jobs_item
  ON public.ai_image_cleanup_jobs (item_id);

CREATE TABLE public.ai_image_cleanup_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.ai_image_cleanup_jobs(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  business_image_id uuid NOT NULL REFERENCES public.item_images(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  original_image_url text NOT NULL,
  original_s3_key text NULL,
  cleaned_image_url text NULL,
  cleaned_s3_key text NULL,
  status public.ai_image_cleanup_result_status NOT NULL DEFAULT 'queued',
  error_message text NULL,
  retry_of_result_id uuid NULL REFERENCES public.ai_image_cleanup_results(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX idx_ai_image_cleanup_results_job_status
  ON public.ai_image_cleanup_results (job_id, status);

CREATE INDEX idx_ai_image_cleanup_results_image
  ON public.ai_image_cleanup_results (business_image_id);

COMMENT ON TABLE public.ai_image_cleanup_jobs IS
  'Async AI image cleanup batch requested by a business after creating an item';
COMMENT ON TABLE public.ai_image_cleanup_results IS
  'Per-image before/after AI cleanup results awaiting merchant accept/reject/retry';

ALTER TABLE public.business_ai_token_usage
  DROP CONSTRAINT IF EXISTS business_ai_token_usage_subject_type_check;

ALTER TABLE public.business_ai_token_usage
  ADD CONSTRAINT business_ai_token_usage_subject_type_check CHECK (
    subject_type IN (
      'business_image',
      'rental_item_image',
      'preview',
      'ai_image_cleanup'
    )
  );
