DELETE FROM public.application_configurations
WHERE config_key IN (
  'referral_pyramid_gen1_percent',
  'referral_pyramid_gen2_percent',
  'referral_pyramid_gen3_percent'
);

DROP TRIGGER IF EXISTS set_public_referral_bonus_distributions_updated_at
  ON public.referral_bonus_distributions;

DROP TABLE IF EXISTS public.referral_bonus_distributions;

DROP INDEX IF EXISTS idx_agent_referrals_referrer_business_id;
DROP INDEX IF EXISTS uq_agent_referrals_referred_agent_id;

ALTER TABLE public.agent_referrals
  DROP CONSTRAINT IF EXISTS agent_referrals_referrer_check;

ALTER TABLE public.agent_referrals
  DROP COLUMN IF EXISTS referrer_business_id;

UPDATE public.agent_referrals
SET referring_agent_id = referring_agent_id
WHERE referring_agent_id IS NOT NULL;

-- Only re-add NOT NULL if no nulls remain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.agent_referrals WHERE referring_agent_id IS NULL
  ) THEN
    ALTER TABLE public.agent_referrals
      ALTER COLUMN referring_agent_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_single_referrer_check;

DROP INDEX IF EXISTS agents_referred_by_business_id_idx;
DROP INDEX IF EXISTS agents_referred_by_agent_id_idx;

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS referral_code_used,
  DROP COLUMN IF EXISTS referred_by_business_id,
  DROP COLUMN IF EXISTS referred_by_agent_id;
