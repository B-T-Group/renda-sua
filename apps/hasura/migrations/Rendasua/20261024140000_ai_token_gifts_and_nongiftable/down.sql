DROP FUNCTION IF EXISTS public.transfer_ai_tokens(uuid, uuid, uuid, uuid, integer, text);

DROP TABLE IF EXISTS public.ai_token_transfers;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_ai_tokens_nongiftable_lte_balance;
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_ai_tokens_nongiftable_nonneg;
ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS ai_tokens_nongiftable;
ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS referral_applied_at;
ALTER TABLE public.agents
  DROP COLUMN IF EXISTS referral_applied_at;
