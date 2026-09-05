DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id FROM public.permissions WHERE key = 'platform.ops.credits'
);

DELETE FROM public.permissions WHERE key = 'platform.ops.credits';

ALTER TABLE public.order_risk_incidents
  DROP COLUMN IF EXISTS order_result,
  DROP COLUMN IF EXISTS contact_channel,
  DROP COLUMN IF EXISTS resolved_by;

DROP TABLE IF EXISTS public.user_credits;

DROP TYPE IF EXISTS public.credit_order_result;
DROP TYPE IF EXISTS public.credit_contact_channel;
DROP TYPE IF EXISTS public.credit_event_type;
