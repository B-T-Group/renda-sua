-- Country-specific signup / onboarding configuration (data-driven, not hardcoded)

CREATE TYPE public.country_verification_flow AS ENUM (
  'stripe_connect',
  'national_id'
);

CREATE TABLE IF NOT EXISTS public.country_onboarding_configs (
  country_code bpchar(2) PRIMARY KEY,
  signup_enabled boolean NOT NULL DEFAULT true,
  postal_code_required boolean NOT NULL DEFAULT false,
  verification_flow public.country_verification_flow NOT NULL DEFAULT 'national_id',
  default_currency text NOT NULL DEFAULT 'XAF',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.country_onboarding_configs IS
  'Per-country signup and onboarding flags used by the persona-aware signup wizard.';

-- Seed current signup markets (matches former SIGNUP_COUNTRY_CODES)
INSERT INTO public.country_onboarding_configs (
  country_code,
  signup_enabled,
  postal_code_required,
  verification_flow,
  default_currency
) VALUES
  ('CM', true, false, 'national_id', 'XAF'),
  ('GA', true, false, 'national_id', 'XAF'),
  ('US', true, true, 'stripe_connect', 'USD'),
  ('CA', true, true, 'stripe_connect', 'CAD')
ON CONFLICT (country_code) DO NOTHING;
