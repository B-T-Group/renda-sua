-- Migration: 1810000000000_create_business_referral_payouts
-- Description: Create the business_referral_payouts tracking table and seed
--              application_configurations for the weekly payout job.

-- 1) Create business_referral_payouts table
CREATE TABLE public.business_referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idempotency: one payout per referred business
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT uq_business_referral_payouts_business_id UNIQUE (business_id),

  agent_id     uuid NOT NULL REFERENCES public.agents(id)   ON UPDATE CASCADE ON DELETE RESTRICT,
  account_id   uuid NOT NULL REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,

  -- Link back to the ledger transaction created by AccountsService.registerTransaction
  transaction_id uuid NULL,

  amount    NUMERIC      NOT NULL,
  currency  currency_enum NOT NULL,
  rail      TEXT         NOT NULL CHECK (rail IN ('stripe', 'mobile_money')),
  item_count INT         NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.business_referral_payouts IS
  'Tracks weekly commission payouts to agents who referred a business that has at least 10 items.';
COMMENT ON COLUMN public.business_referral_payouts.business_id IS
  'The referred business this payout was issued for (unique — prevents double-payment).';
COMMENT ON COLUMN public.business_referral_payouts.transaction_id IS
  'Account transaction id returned by AccountsService.registerTransaction.';
COMMENT ON COLUMN public.business_referral_payouts.rail IS
  'Payment rail resolved at payout time: stripe or mobile_money.';

CREATE INDEX idx_business_referral_payouts_agent_id
  ON public.business_referral_payouts (agent_id);

CREATE TRIGGER set_public_business_referral_payouts_updated_at
  BEFORE UPDATE ON public.business_referral_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_public_business_referral_payouts_updated_at ON public.business_referral_payouts
  IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- 2) Seed application_configurations

-- 2a) Global on/off toggle for the weekly payout job (starts disabled)
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  country_code,
  tags,
  status
) VALUES (
  'business_referral_payout_enabled',
  'Business Referral Payout Enabled',
  'Master toggle for the weekly Saturday cron job that credits agents for referring businesses with 10+ items. Set to true to enable payouts.',
  'boolean',
  false,
  NULL,
  ARRAY['agents', 'referrals', 'commission', 'payout'],
  'active'
)
ON CONFLICT (config_key, country_code) DO NOTHING;

-- 2b) Payout amount for Cameroon (XAF)
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  country_code,
  tags,
  status
) VALUES (
  'business_referral_payout_amount',
  'Business Referral Payout Amount (Cameroon)',
  'Commission credited to an agent per referred business with 10+ items in Cameroon (XAF).',
  'number',
  5000.00,
  'CM',
  ARRAY['agents', 'referrals', 'commission', 'payout'],
  'active'
)
ON CONFLICT (config_key, country_code) DO NOTHING;

-- 2c) Payout amount for Gabon (XAF)
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  country_code,
  tags,
  status
) VALUES (
  'business_referral_payout_amount',
  'Business Referral Payout Amount (Gabon)',
  'Commission credited to an agent per referred business with 10+ items in Gabon (XAF).',
  'number',
  5000.00,
  'GA',
  ARRAY['agents', 'referrals', 'commission', 'payout'],
  'active'
)
ON CONFLICT (config_key, country_code) DO NOTHING;

-- 2d) Payout amount for Canada (CAD)
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  country_code,
  tags,
  status
) VALUES (
  'business_referral_payout_amount',
  'Business Referral Payout Amount (Canada)',
  'Commission credited to an agent per referred business with 10+ items in Canada (CAD). Stripe rail agents receive 10 CAD.',
  'number',
  10.00,
  'CA',
  ARRAY['agents', 'referrals', 'commission', 'payout'],
  'active'
)
ON CONFLICT (config_key, country_code) DO NOTHING;
