DROP TABLE IF EXISTS public.credit_campaign_grants;
DROP TABLE IF EXISTS public.credit_campaigns;

DROP INDEX IF EXISTS public.idx_clients_referred_by_user;

ALTER TABLE public.clients
  DROP COLUMN IF EXISTS referred_by_user_id,
  DROP COLUMN IF EXISTS referral_code_used;
