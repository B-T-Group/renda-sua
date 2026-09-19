-- Idempotent AI image token pack grants (same pattern as reel AI tokens).
-- MoMo SUCCESS retries and concurrent pending callbacks must not increment
-- businesses.ai_tokens more than once per payment reference.

ALTER TABLE public.business_ai_token_usage
  ADD COLUMN IF NOT EXISTS payment_reference text NULL;

ALTER TABLE public.business_ai_token_usage
  DROP CONSTRAINT IF EXISTS business_ai_token_usage_subject_type_check;

ALTER TABLE public.business_ai_token_usage
  ADD CONSTRAINT business_ai_token_usage_subject_type_check CHECK (
    subject_type IN (
      'business_image',
      'rental_item_image',
      'preview',
      'ai_image_cleanup',
      'token_pack'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS business_ai_token_usage_payment_reference_key
  ON public.business_ai_token_usage (payment_reference)
  WHERE payment_reference IS NOT NULL;

COMMENT ON COLUMN public.business_ai_token_usage.payment_reference IS
  'MoMo/Stripe pack payment reference. Unique when set so SUCCESS retries cannot grant twice.';
