-- Migration: 20260812120000_user_referral_code_and_internal
-- Description: Move referral codes to users (one code per user), add users.internal
--              for employee commission tier, unify business-referral payout amounts.

-- 1) users.internal (Rendasua employee flag for referral commission tier)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.internal IS
  'When true, the user is an internal Rendasua employee and earns the higher business-referral commission.';

UPDATE public.users u
SET internal = true
WHERE EXISTS (
  SELECT 1
  FROM public.agents a
  WHERE a.user_id = u.id
    AND a.is_internal = true
);

-- 2) users.referral_code — nullable first for backfill
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code text;

-- 3) Generator must also avoid colliding with users.referral_code
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
      SELECT 1 FROM public.users u WHERE u.referral_code = v_code
    )
    AND NOT EXISTS (
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

-- Prefer agent_code, else earliest business_code, else generate
UPDATE public.users u
SET referral_code = a.agent_code
FROM public.agents a
WHERE a.user_id = u.id
  AND u.referral_code IS NULL;

UPDATE public.users u
SET referral_code = b.business_code
FROM (
  SELECT DISTINCT ON (user_id) user_id, business_code
  FROM public.businesses
  ORDER BY user_id, created_at ASC NULLS LAST
) b
WHERE b.user_id = u.id
  AND u.referral_code IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users u2
    WHERE u2.referral_code = b.business_code
  );

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.users WHERE referral_code IS NULL
  LOOP
    UPDATE public.users
    SET referral_code = public.generate_unique_referral_code()
    WHERE id = r.id;
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  LOOP
    SELECT id INTO r
    FROM public.users u1
    WHERE EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.referral_code = u1.referral_code AND u2.id <> u1.id
    )
    LIMIT 1;
    EXIT WHEN NOT FOUND;
    UPDATE public.users
    SET referral_code = public.generate_unique_referral_code()
    WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.users
  ALTER COLUMN referral_code SET NOT NULL;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_referral_code_key;

ALTER TABLE public.users
  ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);

ALTER TABLE public.users
  ALTER COLUMN referral_code
  SET DEFAULT public.generate_unique_referral_code();

COMMENT ON COLUMN public.users.referral_code IS
  'Public 6-character alphanumeric referral code owned by the user (persona-agnostic).';

CREATE INDEX IF NOT EXISTS users_referral_code_idx
  ON public.users (referral_code);

-- 4) Unify business-referral payout amounts
UPDATE public.application_configurations
SET
  number_value = 10.00,
  description = 'Standard business-referral commission (CAD) for non-internal users after review + 10 approved items.',
  updated_at = NOW()
WHERE config_key = 'business_referral_payout_amount'
  AND country_code = 'CA';

UPDATE public.application_configurations
SET
  number_value = 2000.00,
  description = 'Standard business-referral commission (XAF) for non-internal users after review + 10 approved items.',
  updated_at = NOW()
WHERE config_key = 'business_referral_payout_amount'
  AND country_code IN ('CM', 'GA');

UPDATE public.application_configurations
SET
  number_value = 10.00,
  description = 'Deprecated: use business_referral_payout_amount. Unified standard business-referral amount (CAD).',
  updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount'
  AND country_code = 'CA';

UPDATE public.application_configurations
SET
  number_value = 2000.00,
  description = 'Deprecated: use business_referral_payout_amount. Unified standard business-referral amount (XAF).',
  updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount'
  AND country_code IN ('CM', 'GA');

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, country_code, tags, status
) VALUES
  (
    'business_referral_payout_amount_internal',
    'Business Referral Payout Amount — Internal (Canada)',
    'Business-referral commission (CAD) for internal Rendasua employees after review + 10 approved items.',
    'number', 25.00, 'CA',
    ARRAY['referrals', 'commission', 'payout', 'internal'],
    'active'
  ),
  (
    'business_referral_payout_amount_internal',
    'Business Referral Payout Amount — Internal (Cameroon)',
    'Business-referral commission (XAF) for internal Rendasua employees after review + 10 approved items.',
    'number', 5000.00, 'CM',
    ARRAY['referrals', 'commission', 'payout', 'internal'],
    'active'
  ),
  (
    'business_referral_payout_amount_internal',
    'Business Referral Payout Amount — Internal (Gabon)',
    'Business-referral commission (XAF) for internal Rendasua employees after review + 10 approved items.',
    'number', 5000.00, 'GA',
    ARRAY['referrals', 'commission', 'payout', 'internal'],
    'active'
  )
ON CONFLICT (config_key, country_code) DO UPDATE
SET
  number_value = EXCLUDED.number_value,
  description = EXCLUDED.description,
  status = 'active',
  updated_at = NOW();
