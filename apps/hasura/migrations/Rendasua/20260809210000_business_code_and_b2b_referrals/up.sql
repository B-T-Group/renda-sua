-- Migration: 20260809210000_business_code_and_b2b_referrals
-- Description: Add businesses.business_code, referred_by_business_id, extend
--              business_referral_payouts for business-to-business referrals, seed amounts.

-- 1) business_code (same generator as agents.agent_code)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_code text;

UPDATE public.businesses
SET business_code = UPPER(
  SUBSTRING(
    TRANSLATE(ENCODE(gen_random_bytes(8), 'base64'), '/+=', 'ABC')
    FROM 1 FOR 6
  )
)
WHERE business_code IS NULL;

-- Shared referral-code generator (unique across agents + businesses)
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_tries int := 0;
BEGIN
  LOOP
    v_tries := v_tries + 1;
    v_code := UPPER(
      SUBSTRING(
        TRANSLATE(ENCODE(gen_random_bytes(8), 'base64'), '/+=', 'ABC')
        FROM 1 FOR 6
      )
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.agents a WHERE a.agent_code = v_code
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.business_code = v_code
    );
    IF v_tries > 50 THEN
      RAISE EXCEPTION 'Failed to generate unique referral code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Resolve collisions within businesses and against agents.agent_code
DO $$
DECLARE
  r RECORD;
BEGIN
  LOOP
    SELECT id INTO r
    FROM public.businesses b1
    WHERE EXISTS (
      SELECT 1 FROM public.businesses b2
      WHERE b2.business_code = b1.business_code AND b2.id <> b1.id
    )
    OR EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.agent_code = b1.business_code
    )
    LIMIT 1;
    EXIT WHEN NOT FOUND;
    UPDATE public.businesses
    SET business_code = public.generate_unique_referral_code()
    WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.businesses
  ALTER COLUMN business_code SET NOT NULL;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_business_code_key;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_business_code_key UNIQUE (business_code);

ALTER TABLE public.businesses
  ALTER COLUMN business_code
  SET DEFAULT public.generate_unique_referral_code();

ALTER TABLE public.agents
  ALTER COLUMN agent_code
  SET DEFAULT public.generate_unique_referral_code();

COMMENT ON COLUMN public.businesses.business_code IS
  'Public 6-character alphanumeric slug used for business-to-business referrals.';

-- 2) referred_by_business_id
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS referred_by_business_id uuid NULL
    REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS businesses_referred_by_business_id_idx
  ON public.businesses (referred_by_business_id)
  WHERE referred_by_business_id IS NOT NULL;

COMMENT ON COLUMN public.businesses.referred_by_business_id IS
  'Business that referred this business at signup (immutable after creation)';

-- Ensure only one referrer type is set
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_single_referrer_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_single_referrer_check
  CHECK (
    NOT (
      referred_by_agent_id IS NOT NULL
      AND referred_by_business_id IS NOT NULL
    )
  );

-- 3) Extend business_referral_reviews for business referrers
ALTER TABLE public.business_referral_reviews
  ALTER COLUMN agent_id DROP NOT NULL;

ALTER TABLE public.business_referral_reviews
  ADD COLUMN IF NOT EXISTS referrer_business_id uuid NULL
    REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.business_referral_reviews
  DROP CONSTRAINT IF EXISTS business_referral_reviews_referrer_check;

ALTER TABLE public.business_referral_reviews
  ADD CONSTRAINT business_referral_reviews_referrer_check
  CHECK (
    (agent_id IS NOT NULL AND referrer_business_id IS NULL)
    OR (agent_id IS NULL AND referrer_business_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_business_referral_reviews_referrer_business_id
  ON public.business_referral_reviews (referrer_business_id)
  WHERE referrer_business_id IS NOT NULL;

COMMENT ON COLUMN public.business_referral_reviews.referrer_business_id IS
  'Referring business when the referral is business-to-business.';

-- 4) Extend business_referral_payouts for business referrers
ALTER TABLE public.business_referral_payouts
  ALTER COLUMN agent_id DROP NOT NULL;

ALTER TABLE public.business_referral_payouts
  ADD COLUMN IF NOT EXISTS referrer_business_id uuid NULL
    REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.business_referral_payouts
  DROP CONSTRAINT IF EXISTS business_referral_payouts_referrer_check;

ALTER TABLE public.business_referral_payouts
  ADD CONSTRAINT business_referral_payouts_referrer_check
  CHECK (
    (agent_id IS NOT NULL AND referrer_business_id IS NULL)
    OR (agent_id IS NULL AND referrer_business_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_business_referral_payouts_referrer_business_id
  ON public.business_referral_payouts (referrer_business_id)
  WHERE referrer_business_id IS NOT NULL;

COMMENT ON COLUMN public.business_referral_payouts.referrer_business_id IS
  'Business that referred the business when payout is business-to-business.';

-- 5) Seed business-to-business referral amounts
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, country_code, tags, status
) VALUES
  (
    'business_to_business_referral_amount',
    'Business-to-Business Referral Amount (Cameroon)',
    'Amount credited to a referring business when a referred business is identified and has 10+ approved items (XAF).',
    'number', 2000.00, 'CM',
    ARRAY['business', 'referrals', 'commission', 'payout'],
    'active'
  ),
  (
    'business_to_business_referral_amount',
    'Business-to-Business Referral Amount (Gabon)',
    'Amount credited to a referring business when a referred business is identified and has 10+ approved items (XAF).',
    'number', 2000.00, 'GA',
    ARRAY['business', 'referrals', 'commission', 'payout'],
    'active'
  ),
  (
    'business_to_business_referral_amount',
    'Business-to-Business Referral Amount (Canada)',
    'Amount credited to a referring business when a referred business is identified and has 10+ approved items (CAD).',
    'number', 10.00, 'CA',
    ARRAY['business', 'referrals', 'commission', 'payout'],
    'active'
  )
ON CONFLICT (config_key, country_code) DO NOTHING;
