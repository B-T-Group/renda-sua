CREATE TYPE public.reel_ai_admin_feedback AS ENUM (
  'agree',
  'disagree'
);

CREATE TYPE public.reel_ai_override_action AS ENUM (
  'none',
  'force_approve',
  'force_reject',
  'force_requeue'
);

ALTER TABLE public.reel_ai_reviews
  ADD COLUMN IF NOT EXISTS admin_feedback public.reel_ai_admin_feedback NULL,
  ADD COLUMN IF NOT EXISTS admin_feedback_notes text NULL,
  ADD COLUMN IF NOT EXISTS admin_feedback_by_user_id uuid NULL
    REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_feedback_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS admin_override_action public.reel_ai_override_action NULL;

ALTER TABLE public.reel_ai_reviews
  ALTER COLUMN prompt_version SET DEFAULT 'reel-ai-review-v2';
