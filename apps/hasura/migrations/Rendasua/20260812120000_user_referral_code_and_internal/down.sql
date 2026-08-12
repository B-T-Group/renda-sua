-- Reverse: drop user-level referral code / internal; restore prior CA/CM/GA amounts.

DELETE FROM public.application_configurations
WHERE config_key = 'business_referral_payout_amount_internal';

UPDATE public.application_configurations
SET number_value = 25.00, updated_at = NOW()
WHERE config_key = 'business_referral_payout_amount' AND country_code = 'CA';

UPDATE public.application_configurations
SET number_value = 5000.00, updated_at = NOW()
WHERE config_key = 'business_referral_payout_amount' AND country_code IN ('CM', 'GA');

UPDATE public.application_configurations
SET number_value = 10.00, updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount' AND country_code = 'CA';

UPDATE public.application_configurations
SET number_value = 2000.00, updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount' AND country_code IN ('CM', 'GA');

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

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_referral_code_key;
DROP INDEX IF EXISTS public.users_referral_code_idx;
ALTER TABLE public.users DROP COLUMN IF EXISTS referral_code;
ALTER TABLE public.users DROP COLUMN IF EXISTS internal;
