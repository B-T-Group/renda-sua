DROP TRIGGER IF EXISTS item_rejections_require_current ON public.item_rejections;
DROP FUNCTION IF EXISTS public.item_rejections_require_current();
-- Postgres cannot drop enum values; the new enum types are dropped whole.
DROP TRIGGER IF EXISTS items_withdraw_pending_appeals ON public.items;
DROP TRIGGER IF EXISTS items_clear_rejection_category ON public.items;
DROP TRIGGER IF EXISTS items_sync_condition_is_used ON public.items;
DROP FUNCTION IF EXISTS public.items_withdraw_pending_appeals();
DROP FUNCTION IF EXISTS public.items_clear_rejection_category();
DROP FUNCTION IF EXISTS public.items_sync_condition_is_used();

DROP TABLE IF EXISTS public.item_moderation_audit;
DROP TABLE IF EXISTS public.item_appeals;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_rejected_requires_category_chk,
  DROP CONSTRAINT IF EXISTS items_wear_note_length_chk,
  DROP COLUMN IF EXISTS current_rejection_id,
  DROP COLUMN IF EXISTS rejection_category,
  DROP COLUMN IF EXISTS wear_note,
  DROP COLUMN IF EXISTS condition;

DROP TABLE IF EXISTS public.item_rejections;

DROP TYPE IF EXISTS public.item_appeal_status;
DROP TYPE IF EXISTS public.item_condition;
DROP TYPE IF EXISTS public.item_rejection_category;

DELETE FROM public.application_configurations
WHERE config_key IN ('item_appeal_limit_per_rejection', 'item_appeal_sla_hours');
