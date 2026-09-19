DROP INDEX IF EXISTS public.business_ai_token_usage_payment_reference_key;

ALTER TABLE public.business_ai_token_usage
  DROP CONSTRAINT IF EXISTS business_ai_token_usage_subject_type_check;

ALTER TABLE public.business_ai_token_usage
  ADD CONSTRAINT business_ai_token_usage_subject_type_check CHECK (
    subject_type IN (
      'business_image',
      'rental_item_image',
      'preview',
      'ai_image_cleanup'
    )
  );

ALTER TABLE public.business_ai_token_usage
  DROP COLUMN IF EXISTS payment_reference;
