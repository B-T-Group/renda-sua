-- Revert welcome credit to previous fast-tier cost (2 tokens).
ALTER TABLE public.businesses
  ALTER COLUMN ai_reel_tokens SET DEFAULT 2;

UPDATE public.businesses b
SET ai_reel_tokens = 2
WHERE b.ai_reel_tokens = 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_ai_reel_token_usage u
    WHERE u.business_id = b.id
      AND u.operation_type = 'purchase'
  );
