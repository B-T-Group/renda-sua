-- Sale item moderation + AI auto-review (mirrors rental listing pipeline)

CREATE TYPE public.item_moderation_status AS ENUM (
  'draft',
  'pending',
  'ai_reviewing',
  'proposal_pending',
  'approved',
  'rejected'
);

ALTER TABLE public.items
  ADD COLUMN moderation_status public.item_moderation_status NOT NULL DEFAULT 'draft',
  ADD COLUMN moderated_at timestamptz NULL,
  ADD COLUMN moderated_by_user_id uuid NULL REFERENCES public.users(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  ADD COLUMN ai_reviewed_at timestamptz NULL,
  ADD COLUMN ai_review_version integer NOT NULL DEFAULT 0,
  ADD COLUMN moderation_source text NULL;

COMMENT ON COLUMN public.items.moderation_status IS
  'draft = unsubmitted; pending/ai_reviewing/proposal_pending/approved/rejected = review pipeline';
COMMENT ON COLUMN public.items.moderation_source IS
  'Who last decided: ai | admin | business_accept';

-- Keep existing live catalog items visible after moderation gate is enforced
UPDATE public.items
SET moderation_status = 'approved',
    moderation_source = 'admin',
    moderated_at = COALESCE(moderated_at, now())
WHERE status = 'active'
  AND is_active = true
  AND moderation_status = 'draft';

INSERT INTO public.entity_types (id, comment)
VALUES ('sale_item', 'Sale item moderation messages')
ON CONFLICT (id) DO NOTHING;

CREATE TYPE public.item_ai_review_status AS ENUM (
  'running',
  'approved',
  'proposal',
  'rejected',
  'failed'
);

CREATE TYPE public.item_ai_admin_feedback AS ENUM (
  'agree',
  'disagree'
);

CREATE TYPE public.item_ai_override_action AS ENUM (
  'none',
  'force_approve',
  'force_reject',
  'force_requeue'
);

CREATE TABLE public.item_ai_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  status public.item_ai_review_status NOT NULL DEFAULT 'running',
  decision_reason text NULL,
  alignment_score numeric NULL,
  rubric jsonb NULL,
  input_snapshot jsonb NULL,
  raw_model_response jsonb NULL,
  proposed_title text NULL,
  proposed_description text NULL,
  rejection_fields text[] NOT NULL DEFAULT '{}',
  model_meta jsonb NULL,
  prompt_version text NOT NULL DEFAULT 'item-ai-review-v1',
  review_version integer NOT NULL DEFAULT 0,
  admin_feedback public.item_ai_admin_feedback NULL,
  admin_feedback_notes text NULL,
  admin_feedback_by_user_id uuid NULL REFERENCES public.users(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  admin_feedback_at timestamptz NULL,
  admin_override_action public.item_ai_override_action NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX idx_item_ai_reviews_item_created
  ON public.item_ai_reviews (item_id, created_at DESC);

CREATE INDEX idx_item_ai_reviews_status_created
  ON public.item_ai_reviews (status, created_at DESC);

CREATE INDEX idx_item_ai_reviews_prompt_version
  ON public.item_ai_reviews (prompt_version);

CREATE TABLE public.item_ai_proposed_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.item_ai_reviews(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  source_image_id uuid NULL REFERENCES public.item_images(id)
    ON UPDATE RESTRICT ON DELETE SET NULL,
  image_url text NOT NULL,
  s3_key text NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_ai_proposed_images_review
  ON public.item_ai_proposed_images (review_id, display_order);
