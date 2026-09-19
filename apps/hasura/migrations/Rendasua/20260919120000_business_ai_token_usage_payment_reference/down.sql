DROP INDEX IF EXISTS public.business_ai_token_usage_payment_reference_key;

ALTER TABLE public.business_ai_token_usage
  DROP COLUMN IF EXISTS payment_reference;

-- Existing purchase-claim rows have null subject_type; remove them before restore.
DELETE FROM public.business_ai_token_usage
WHERE subject_type IS NULL;

ALTER TABLE public.business_ai_token_usage
  ALTER COLUMN subject_type SET NOT NULL;
