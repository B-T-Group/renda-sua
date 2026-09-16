ALTER TABLE public.reel_ai_reviews
  DROP COLUMN IF EXISTS admin_override_action,
  DROP COLUMN IF EXISTS admin_feedback_at,
  DROP COLUMN IF EXISTS admin_feedback_by_user_id,
  DROP COLUMN IF EXISTS admin_feedback_notes,
  DROP COLUMN IF EXISTS admin_feedback;

ALTER TABLE public.reel_ai_reviews
  ALTER COLUMN prompt_version SET DEFAULT 'reel-ai-review-v1';

DROP TYPE IF EXISTS public.reel_ai_override_action;
DROP TYPE IF EXISTS public.reel_ai_admin_feedback;
