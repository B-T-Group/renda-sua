-- AI auto-review audit trail for identity document uploads

CREATE TYPE public.id_document_ai_review_status AS ENUM (
  'running',
  'completed',
  'failed'
);

CREATE TYPE public.id_document_ai_decision AS ENUM (
  'approve',
  'needs_review'
);

CREATE TABLE public.id_document_ai_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.user_uploads(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  persona text NOT NULL,
  status public.id_document_ai_review_status NOT NULL DEFAULT 'running',
  decision public.id_document_ai_decision NULL,
  expected_name text NULL,
  extracted_name text NULL,
  confidence numeric NULL,
  reasons jsonb NULL,
  model text NULL,
  prompt_version text NOT NULL DEFAULT 'id-document-ai-review-v1',
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  CONSTRAINT id_document_ai_reviews_persona_check
    CHECK (persona IN ('business', 'agent'))
);

CREATE INDEX idx_id_document_ai_reviews_upload_created
  ON public.id_document_ai_reviews (upload_id, created_at DESC);

CREATE INDEX idx_id_document_ai_reviews_status_created
  ON public.id_document_ai_reviews (status, created_at DESC);

CREATE INDEX idx_id_document_ai_reviews_user_created
  ON public.id_document_ai_reviews (user_id, created_at DESC);

COMMENT ON TABLE public.id_document_ai_reviews IS
  'AI review attempts for identity documents (id_card, passport, driver_license)';
COMMENT ON COLUMN public.id_document_ai_reviews.decision IS
  'approve = auto-approved; needs_review = left for superuser';
