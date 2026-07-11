DROP TABLE IF EXISTS public.item_ai_proposed_images;
DROP TABLE IF EXISTS public.item_ai_reviews;

DROP TYPE IF EXISTS public.item_ai_override_action;
DROP TYPE IF EXISTS public.item_ai_admin_feedback;
DROP TYPE IF EXISTS public.item_ai_review_status;

ALTER TABLE public.items
  DROP COLUMN IF EXISTS moderation_source,
  DROP COLUMN IF EXISTS ai_review_version,
  DROP COLUMN IF EXISTS ai_reviewed_at,
  DROP COLUMN IF EXISTS moderated_by_user_id,
  DROP COLUMN IF EXISTS moderated_at,
  DROP COLUMN IF EXISTS moderation_status;

DROP TYPE IF EXISTS public.item_moderation_status;

DELETE FROM public.entity_types WHERE id = 'sale_item';
