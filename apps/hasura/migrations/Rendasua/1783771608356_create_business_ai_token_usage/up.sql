CREATE TABLE public.business_ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  tokens_consumed integer NOT NULL DEFAULT 1,
  operation_type text NOT NULL DEFAULT 'image_cleanup',
  subject_type text NOT NULL,
  subject_id uuid,
  image_url text,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_ai_token_usage_tokens_positive CHECK (tokens_consumed > 0),
  CONSTRAINT business_ai_token_usage_subject_type_check CHECK (
    subject_type IN ('business_image', 'rental_item_image', 'preview')
  )
);

COMMENT ON TABLE public.business_ai_token_usage IS
  'Append-only audit of AI token consumption (e.g. image cleanup).';

COMMENT ON COLUMN public.business_ai_token_usage.subject_type IS
  'What the tokens were used for: business_image, rental_item_image, or preview (pre-upload).';

CREATE INDEX idx_business_ai_token_usage_business_created
  ON public.business_ai_token_usage (business_id, created_at DESC);
