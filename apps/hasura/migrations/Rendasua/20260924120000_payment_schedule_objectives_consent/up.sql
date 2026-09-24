-- Payment schedule objectives + agent accept / defer / reject consent.

ALTER TYPE public.payment_program_status ADD VALUE IF NOT EXISTS 'pending_acceptance';
ALTER TYPE public.payment_program_status ADD VALUE IF NOT EXISTS 'rejected';

CREATE TYPE public.payment_schedule_assignment_decision AS ENUM (
  'pending',
  'deferred',
  'accepted',
  'rejected'
);

CREATE TYPE public.payment_schedule_decision_event AS ENUM (
  'offered',
  'deferred',
  'accepted',
  'rejected'
);

CREATE TYPE public.payment_schedule_reject_reason AS ENUM (
  'too_aggressive',
  'not_ready_now',
  'targets_unclear',
  'other'
);

ALTER TABLE public.payment_schedules
  ADD COLUMN IF NOT EXISTS target_agent_recruitments INTEGER
    CHECK (target_agent_recruitments IS NULL OR target_agent_recruitments > 0),
  ADD COLUMN IF NOT EXISTS target_client_signups INTEGER
    CHECK (target_client_signups IS NULL OR target_client_signups > 0),
  ADD COLUMN IF NOT EXISTS target_merchant_recruitments INTEGER
    CHECK (target_merchant_recruitments IS NULL OR target_merchant_recruitments > 0),
  ADD COLUMN IF NOT EXISTS target_item_sales_amount DECIMAL(18,2)
    CHECK (target_item_sales_amount IS NULL OR target_item_sales_amount > 0),
  ADD COLUMN IF NOT EXISTS target_rental_amount DECIMAL(18,2)
    CHECK (target_rental_amount IS NULL OR target_rental_amount > 0);

ALTER TABLE public.payment_schedule_assignments
  ADD COLUMN IF NOT EXISTS target_agent_recruitments INTEGER
    CHECK (target_agent_recruitments IS NULL OR target_agent_recruitments > 0),
  ADD COLUMN IF NOT EXISTS target_client_signups INTEGER
    CHECK (target_client_signups IS NULL OR target_client_signups > 0),
  ADD COLUMN IF NOT EXISTS target_merchant_recruitments INTEGER
    CHECK (target_merchant_recruitments IS NULL OR target_merchant_recruitments > 0),
  ADD COLUMN IF NOT EXISTS target_item_sales_amount DECIMAL(18,2)
    CHECK (target_item_sales_amount IS NULL OR target_item_sales_amount > 0),
  ADD COLUMN IF NOT EXISTS target_rental_amount DECIMAL(18,2)
    CHECK (target_rental_amount IS NULL OR target_rental_amount > 0),
  ADD COLUMN IF NOT EXISTS decision public.payment_schedule_assignment_decision
    NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason public.payment_schedule_reject_reason,
  ADD COLUMN IF NOT EXISTS reject_note TEXT;

-- Existing stipends keep paying without re-consent.
UPDATE public.payment_schedule_assignments
SET decision = 'accepted',
    accepted_at = COALESCE(accepted_at, starts_at, created_at)
WHERE decision = 'pending'
  AND status IN ('active', 'paused', 'ended', 'cancelled', 'closed');

-- status default stays 'active' for cash-advance compatibility; new schedule
-- assignments set status = pending_acceptance explicitly in application code.

CREATE TABLE public.payment_schedule_assignment_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES public.payment_schedule_assignments(id) ON DELETE CASCADE,
  event public.payment_schedule_decision_event NOT NULL,
  reason_code public.payment_schedule_reject_reason,
  note TEXT,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ps_assignment_decisions_assignment
  ON public.payment_schedule_assignment_decisions (assignment_id, created_at DESC);

CREATE INDEX idx_ps_assignments_decision
  ON public.payment_schedule_assignments (decision, status)
  WHERE decision IN ('pending', 'deferred');

INSERT INTO public.message_types (id, comment) VALUES
  ('PAYMENT_SCHEDULE_OFFER', 'A payment schedule was offered and needs agent consent'),
  ('PAYMENT_SCHEDULE_DECISION', 'An agent accepted or rejected a payment schedule offer')
ON CONFLICT (id) DO NOTHING;
