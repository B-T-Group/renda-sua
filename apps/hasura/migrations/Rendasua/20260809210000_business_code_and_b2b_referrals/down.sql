DELETE FROM public.application_configurations
WHERE config_key = 'business_to_business_referral_amount';

ALTER TABLE public.business_referral_payouts
  DROP CONSTRAINT IF EXISTS business_referral_payouts_referrer_check;

DROP INDEX IF EXISTS idx_business_referral_payouts_referrer_business_id;

ALTER TABLE public.business_referral_payouts
  DROP COLUMN IF EXISTS referrer_business_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.business_referral_payouts WHERE agent_id IS NULL
  ) THEN
    ALTER TABLE public.business_referral_payouts
      ALTER COLUMN agent_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.business_referral_reviews
  DROP CONSTRAINT IF EXISTS business_referral_reviews_referrer_check;

DROP INDEX IF EXISTS idx_business_referral_reviews_referrer_business_id;

ALTER TABLE public.business_referral_reviews
  DROP COLUMN IF EXISTS referrer_business_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.business_referral_reviews WHERE agent_id IS NULL
  ) THEN
    ALTER TABLE public.business_referral_reviews
      ALTER COLUMN agent_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_single_referrer_check;

DROP INDEX IF EXISTS businesses_referred_by_business_id_idx;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS referred_by_business_id;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_business_code_key;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS business_code;

ALTER TABLE public.agents
  ALTER COLUMN agent_code
  SET DEFAULT UPPER(
    SUBSTRING(
      TRANSLATE(ENCODE(gen_random_bytes(8), 'base64'), '/+=', 'ABC')
      FROM 1 FOR 6
    )
  );

DROP FUNCTION IF EXISTS public.generate_unique_referral_code();
