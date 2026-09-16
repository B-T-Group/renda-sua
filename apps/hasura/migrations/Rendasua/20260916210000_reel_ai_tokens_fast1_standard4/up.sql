-- Welcome credit matches default generate cost (fast = 1 token).
ALTER TABLE public.businesses
  ALTER COLUMN ai_reel_tokens SET DEFAULT 1;

-- Claw back only unused 2-token welcome grants. Skip anyone who purchased
-- reel tokens so paid balances of 2 are not reduced.
UPDATE public.businesses b
SET ai_reel_tokens = 1
WHERE b.ai_reel_tokens = 2
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_ai_reel_token_usage u
    WHERE u.business_id = b.id
      AND u.operation_type = 'purchase'
  );
