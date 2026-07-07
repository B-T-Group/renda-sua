DROP INDEX IF EXISTS public.businesses_referred_by_agent_id_idx;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS referral_code_used,
  DROP COLUMN IF EXISTS referred_by_agent_id;
