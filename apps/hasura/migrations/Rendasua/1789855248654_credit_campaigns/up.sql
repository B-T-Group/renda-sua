ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS referral_code_used TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_referred_by_user
  ON public.clients (referred_by_user_id)
  WHERE referred_by_user_id IS NOT NULL;

CREATE TABLE public.credit_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'signup',
  persona TEXT NOT NULL DEFAULT 'client',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  currency public.currency_enum NOT NULL,
  store_scope TEXT NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  subject_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  subject_bonus_if_referred NUMERIC(18,2) NOT NULL DEFAULT 0,
  store_credit_expires_days INTEGER,
  referrer_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  max_referrer_rewards INTEGER NOT NULL DEFAULT 5,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_campaigns_window CHECK (ends_at > starts_at),
  CONSTRAINT credit_campaigns_event CHECK (event_type = 'signup'),
  CONSTRAINT credit_campaigns_persona CHECK (persona IN ('client', 'agent', 'business', 'any')),
  CONSTRAINT credit_campaigns_scope CHECK (store_scope IN ('any_store', 'partner_businesses', 'specific_business')),
  CONSTRAINT credit_campaigns_business CHECK (
    (store_scope = 'specific_business' AND business_id IS NOT NULL)
    OR (store_scope <> 'specific_business' AND business_id IS NULL)
  ),
  CONSTRAINT credit_campaigns_amounts CHECK (
    subject_amount >= 0
    AND subject_bonus_if_referred >= 0
    AND referrer_amount >= 0
    AND max_referrer_rewards >= 0
  )
);

CREATE TABLE public.credit_campaign_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.credit_campaigns(id) ON DELETE RESTRICT,
  signup_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  beneficiary_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  beneficiary_role TEXT NOT NULL,
  credit_kind TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency public.currency_enum NOT NULL,
  status TEXT NOT NULL,
  skip_reason TEXT,
  purchase_credit_grant_id UUID REFERENCES public.purchase_credit_grants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_campaign_grants_role CHECK (beneficiary_role IN ('subject', 'referrer')),
  CONSTRAINT credit_campaign_grants_kind CHECK (credit_kind IN ('store', 'wallet')),
  CONSTRAINT credit_campaign_grants_status CHECK (status IN ('pending', 'posting', 'posted', 'skipped')),
  CONSTRAINT credit_campaign_grants_once UNIQUE (campaign_id, signup_user_id, beneficiary_role)
);

CREATE INDEX idx_credit_campaign_grants_referrer_posted
  ON public.credit_campaign_grants (campaign_id, beneficiary_user_id)
  WHERE beneficiary_role = 'referrer' AND status = 'posted';
