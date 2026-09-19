-- Idempotent image-AI token pack grants (MoMo/Stripe callback replay).
ALTER TABLE public.business_ai_token_usage
  ADD COLUMN IF NOT EXISTS payment_reference text NULL;

ALTER TABLE public.business_ai_token_usage
  ALTER COLUMN subject_type DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_ai_token_usage_payment_reference_key
  ON public.business_ai_token_usage (payment_reference)
  WHERE payment_reference IS NOT NULL;
