-- Payment programs: scheduled stipends, cash advances, scoped purchase credits.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cash_advance_balance DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_cash_advance_balance_non_positive;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_cash_advance_balance_non_positive
  CHECK (cash_advance_balance <= 0);

COMMENT ON COLUMN public.accounts.cash_advance_balance IS
  'Cash-advance debt. Zero or negative. Incoming deposits repay this before available_balance.';

ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'cash_advance';
ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'cash_advance_repayment';

CREATE TYPE public.payment_schedule_frequency AS ENUM (
  'daily', 'weekly', 'biweekly', 'monthly'
);

CREATE TYPE public.payment_program_status AS ENUM (
  'active', 'paused', 'ended', 'cancelled', 'closed'
);

CREATE TYPE public.payment_schedule_run_status AS ENUM (
  'posted', 'failed', 'skipped'
);

CREATE TYPE public.purchase_credit_applicability AS ENUM (
  'any_store', 'partner_businesses', 'specific_business'
);

CREATE TYPE public.purchase_credit_source AS ENUM ('admin', 'campaign');

CREATE TABLE public.payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  frequency public.payment_schedule_frequency NOT NULL,
  currency public.currency_enum NOT NULL,
  default_amount DECIMAL(18,2) NOT NULL CHECK (default_amount > 0),
  default_duration_days INTEGER CHECK (default_duration_days IS NULL OR default_duration_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.payment_schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.payment_schedules(id) ON DELETE RESTRICT,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  currency public.currency_enum NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status public.payment_program_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_schedule_assignments_end_after_start
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE public.payment_schedule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.payment_schedule_assignments(id) ON DELETE RESTRICT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  status public.payment_schedule_run_status NOT NULL,
  hq_transaction_id UUID REFERENCES public.account_transactions(id) ON DELETE SET NULL,
  agent_transaction_id UUID REFERENCES public.account_transactions(id) ON DELETE SET NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_schedule_runs_unique_period UNIQUE (assignment_id, period_start)
);

CREATE TABLE public.cash_advance_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency public.currency_enum NOT NULL,
  default_limit DECIMAL(18,2) NOT NULL CHECK (default_limit > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cash_advance_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.cash_advance_programs(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  limit_amount DECIMAL(18,2) NOT NULL CHECK (limit_amount > 0),
  currency public.currency_enum NOT NULL,
  status public.payment_program_status NOT NULL DEFAULT 'active',
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_cash_advance_facilities_one_active
  ON public.cash_advance_facilities (user_id, currency)
  WHERE status = 'active';

CREATE TABLE public.cash_advance_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.cash_advance_facilities(id) ON DELETE RESTRICT,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  transaction_id UUID REFERENCES public.account_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.partner_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.purchase_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  currency public.currency_enum NOT NULL,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  remaining_amount DECIMAL(18,2) NOT NULL CHECK (remaining_amount >= 0 AND remaining_amount <= amount),
  applicability public.purchase_credit_applicability NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ,
  source public.purchase_credit_source NOT NULL DEFAULT 'admin',
  source_id UUID,
  memo TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_credit_grants_scope_business CHECK (
    (applicability = 'specific_business' AND business_id IS NOT NULL)
    OR (applicability <> 'specific_business' AND business_id IS NULL)
  )
);

CREATE TABLE public.purchase_credit_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.purchase_credit_grants(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_schedule_assignments_agent
  ON public.payment_schedule_assignments (agent_id, status);
CREATE INDEX idx_payment_schedule_runs_status
  ON public.payment_schedule_runs (status, created_at DESC);
CREATE INDEX idx_cash_advance_facilities_user
  ON public.cash_advance_facilities (user_id, status);
CREATE INDEX idx_purchase_credit_grants_user
  ON public.purchase_credit_grants (user_id, currency, remaining_amount);
CREATE INDEX idx_purchase_credit_redemptions_order
  ON public.purchase_credit_redemptions (order_id);

CREATE TRIGGER set_public_payment_schedules_updated_at
  BEFORE UPDATE ON public.payment_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_public_payment_schedule_assignments_updated_at
  BEFORE UPDATE ON public.payment_schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_public_cash_advance_programs_updated_at
  BEFORE UPDATE ON public.cash_advance_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_public_cash_advance_facilities_updated_at
  BEFORE UPDATE ON public.cash_advance_facilities
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_public_partner_businesses_updated_at
  BEFORE UPDATE ON public.partner_businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER set_public_purchase_credit_grants_updated_at
  BEFORE UPDATE ON public.purchase_credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

INSERT INTO public.permissions (key, description, category) VALUES
  ('platform.financial.payment_programs', 'Create payment schedules, cash advances, and purchase credits', 'finance')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'finance'
  AND p.key = 'platform.financial.payment_programs'
ON CONFLICT DO NOTHING;

INSERT INTO public.message_types (id, comment) VALUES
  ('PAYMENT_SCHEDULE', 'Scheduled stipend credited to an agent wallet'),
  ('CASH_ADVANCE_FACILITY', 'A cash-advance credit line was opened'),
  ('CASH_ADVANCE_DRAW', 'A user drew on a cash-advance facility'),
  ('PURCHASE_CREDIT', 'Purchase credits were granted')
ON CONFLICT (id) DO NOTHING;
