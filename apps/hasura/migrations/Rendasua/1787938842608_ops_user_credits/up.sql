-- Ops progress credits: weighted points for referrals, escalation resolve, and call-back feedback.
-- Not wallet money. Backend awards via HasuraSystemService (no Hasura role permissions).

CREATE TYPE public.credit_event_type AS ENUM (
  'escalation_resolved',
  'business_referred',
  'agent_referred',
  'cancelled_feedback',
  'first_order_completed_feedback',
  'my_first_purchase'
);

CREATE TYPE public.credit_contact_channel AS ENUM (
  'in_app_message',
  'call',
  'email'
);

CREATE TYPE public.credit_order_result AS ENUM (
  'order_cancelled',
  'confirmed',
  'system_cancelled'
);

CREATE TABLE IF NOT EXISTS public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type public.credit_event_type NOT NULL,
  weight integer NOT NULL CHECK (weight > 0),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_risk_incident_id uuid REFERENCES public.order_risk_incidents(id) ON DELETE SET NULL,
  referred_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  referred_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  contact_channel public.credit_contact_channel,
  order_result public.credit_order_result,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.user_credits IS
  'Weighted progress credits (not wallet money). Weight is snapshotted at award time.';
COMMENT ON COLUMN public.user_credits.weight IS
  'Points for this event, copied from the event-type weight map when awarded';
COMMENT ON COLUMN public.user_credits.notes IS
  'Ops comments / call-back feedback text';

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_credits_escalation_incident
  ON public.user_credits (order_risk_incident_id)
  WHERE event_type = 'escalation_resolved' AND order_risk_incident_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_credits_business_referred
  ON public.user_credits (referred_business_id)
  WHERE event_type = 'business_referred' AND referred_business_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_credits_agent_referred
  ON public.user_credits (referred_agent_id)
  WHERE event_type = 'agent_referred' AND referred_agent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_credits_cancelled_feedback
  ON public.user_credits (order_id)
  WHERE event_type = 'cancelled_feedback' AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_credits_first_order_feedback
  ON public.user_credits (order_id)
  WHERE event_type = 'first_order_completed_feedback' AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_credits_my_first_purchase
  ON public.user_credits (user_id)
  WHERE event_type = 'my_first_purchase';

CREATE INDEX IF NOT EXISTS idx_user_credits_user_created
  ON public.user_credits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_credits_event_created
  ON public.user_credits (event_type, created_at DESC);

-- Human resolution details on risk incidents (nullable; auto-resolve leaves these null).
ALTER TABLE public.order_risk_incidents
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_channel public.credit_contact_channel,
  ADD COLUMN IF NOT EXISTS order_result public.credit_order_result;

COMMENT ON COLUMN public.order_risk_incidents.resolved_by IS
  'User who recorded a human resolution (not auto_resolved / order_closed)';
COMMENT ON COLUMN public.order_risk_incidents.contact_channel IS
  'How ops contacted participants when resolving';
COMMENT ON COLUMN public.order_risk_incidents.order_result IS
  'Recorded outcome of the intervention (does not itself change order status)';

-- Permission for credits dashboard / feedback queues.
INSERT INTO public.permissions (key, description, category) VALUES
  (
    'platform.ops.credits',
    'View ops credit queues and leaderboard; record cancelled and first-order feedback',
    'ops'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'order_manager'
  AND p.key = 'platform.ops.credits'
ON CONFLICT (role_id, permission_id) DO NOTHING;
