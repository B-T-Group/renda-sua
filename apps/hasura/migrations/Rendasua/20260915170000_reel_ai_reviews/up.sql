CREATE TYPE public.reel_ai_review_status AS ENUM (
  'running', 'approved', 'failed', 'skipped'
);

CREATE TABLE public.reel_ai_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  status public.reel_ai_review_status NOT NULL DEFAULT 'running',
  review_version integer NOT NULL DEFAULT 1,
  prompt_version text NOT NULL DEFAULT 'reel-ai-review-v1',
  input_snapshot jsonb NULL,
  raw_model_response jsonb NULL,
  decision_reason text NULL,
  model_meta jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX reel_ai_reviews_reel_created_idx
  ON public.reel_ai_reviews (reel_id, created_at DESC);
CREATE INDEX reel_ai_reviews_status_created_idx
  ON public.reel_ai_reviews (status, created_at);
