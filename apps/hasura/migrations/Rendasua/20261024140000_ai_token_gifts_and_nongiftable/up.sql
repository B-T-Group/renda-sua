-- Business-to-business AI image token gifts.
-- Protects the signup free allotment (20) from being gifted via ai_tokens_nongiftable.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS ai_tokens_nongiftable integer NOT NULL DEFAULT 0;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_ai_tokens_nongiftable_nonneg;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_ai_tokens_nongiftable_nonneg
  CHECK (ai_tokens_nongiftable >= 0);

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_ai_tokens_nongiftable_lte_balance;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_ai_tokens_nongiftable_lte_balance
  CHECK (ai_tokens_nongiftable <= ai_tokens);

COMMENT ON COLUMN public.businesses.ai_tokens_nongiftable IS
  'Free/promo image AI tokens that cannot be gifted. Cleanup spends these first. New businesses start with 20.';

-- Existing businesses: lock min(20, current balance) as non-giftable.
UPDATE public.businesses
SET ai_tokens_nongiftable = LEAST(20, ai_tokens)
WHERE ai_tokens_nongiftable = 0 AND ai_tokens > 0;

-- Default for new rows matches signup grant.
ALTER TABLE public.businesses
  ALTER COLUMN ai_tokens_nongiftable SET DEFAULT 20;

CREATE TABLE IF NOT EXISTS public.ai_token_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  sender_business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  sender_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  recipient_business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_token_transfers_amount_range CHECK (amount >= 10 AND amount <= 5000),
  CONSTRAINT ai_token_transfers_status_check CHECK (status IN ('completed', 'reversed')),
  CONSTRAINT ai_token_transfers_distinct_businesses CHECK (sender_business_id <> recipient_business_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_token_transfers_sender_idempotency_key
  ON public.ai_token_transfers (sender_business_id, idempotency_key);

CREATE INDEX IF NOT EXISTS ai_token_transfers_sender_created_at
  ON public.ai_token_transfers (sender_business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_token_transfers_recipient_created_at
  ON public.ai_token_transfers (recipient_business_id, created_at DESC);

COMMENT ON TABLE public.ai_token_transfers IS
  'Audit of business-to-business AI image token gifts. Balances move on businesses.ai_tokens.';

CREATE OR REPLACE FUNCTION public.transfer_ai_tokens(
  p_sender_business_id uuid,
  p_sender_user_id uuid,
  p_recipient_business_id uuid,
  p_recipient_user_id uuid,
  p_amount integer,
  p_idempotency_key text
)
RETURNS SETOF public.ai_token_transfers
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_existing public.ai_token_transfers%ROWTYPE;
  v_sender_tokens integer;
  v_sender_nongiftable integer;
  v_giftable integer;
  v_gift_count integer;
  v_lock_a uuid;
  v_lock_b uuid;
BEGIN
  IF p_amount IS NULL OR p_amount < 10 OR p_amount > 5000 THEN
    RAISE EXCEPTION 'ai_token_transfer_invalid_amount'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'ai_token_transfer_missing_idempotency'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_sender_business_id = p_recipient_business_id THEN
    RAISE EXCEPTION 'ai_token_transfer_self'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Deterministic lock order to avoid deadlocks.
  IF p_sender_business_id < p_recipient_business_id THEN
    v_lock_a := p_sender_business_id;
    v_lock_b := p_recipient_business_id;
  ELSE
    v_lock_a := p_recipient_business_id;
    v_lock_b := p_sender_business_id;
  END IF;

  PERFORM 1 FROM public.businesses WHERE id = v_lock_a FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ai_token_transfer_business_missing'
      USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM 1 FROM public.businesses WHERE id = v_lock_b FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ai_token_transfer_business_missing'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_existing
    FROM public.ai_token_transfers
   WHERE sender_business_id = p_sender_business_id
     AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN NEXT v_existing;
    RETURN;
  END IF;

  SELECT count(*) INTO v_gift_count
    FROM public.ai_token_transfers
   WHERE sender_business_id = p_sender_business_id
     AND status = 'completed'
     AND created_at > now() - interval '24 hours';

  IF v_gift_count >= 3 THEN
    RAISE EXCEPTION 'ai_token_transfer_daily_limit'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT ai_tokens, ai_tokens_nongiftable
    INTO v_sender_tokens, v_sender_nongiftable
    FROM public.businesses
   WHERE id = p_sender_business_id;

  v_giftable := GREATEST(0, v_sender_tokens - v_sender_nongiftable);
  IF p_amount > v_giftable THEN
    RAISE EXCEPTION 'ai_token_transfer_insufficient'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.businesses
     SET ai_tokens = ai_tokens - p_amount,
         updated_at = now()
   WHERE id = p_sender_business_id
     AND ai_tokens - p_amount >= ai_tokens_nongiftable;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ai_token_transfer_insufficient'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.businesses
     SET ai_tokens = ai_tokens + p_amount,
         updated_at = now()
   WHERE id = p_recipient_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ai_token_transfer_recipient_missing'
      USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.ai_token_transfers (
    idempotency_key,
    sender_business_id,
    sender_user_id,
    recipient_business_id,
    recipient_user_id,
    amount,
    status
  ) VALUES (
    p_idempotency_key,
    p_sender_business_id,
    p_sender_user_id,
    p_recipient_business_id,
    p_recipient_user_id,
    p_amount,
    'completed'
  )
  RETURNING * INTO v_existing;

  RETURN NEXT v_existing;
END;
$$;

COMMENT ON FUNCTION public.transfer_ai_tokens(uuid, uuid, uuid, uuid, integer, text) IS
  'Atomically gift image AI tokens from one business to another; idempotent per sender+key; max 3 gifts / 24h.';

-- When a referral was attributed (signup or late self-serve). Used so bonuses
-- only count activity after this timestamp.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS referral_applied_at timestamptz NULL;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS referral_applied_at timestamptz NULL;

UPDATE public.businesses
SET referral_applied_at = created_at
WHERE referral_code_used IS NOT NULL
  AND referral_applied_at IS NULL;

UPDATE public.agents
SET referral_applied_at = created_at
WHERE referral_code_used IS NOT NULL
  AND referral_applied_at IS NULL;

COMMENT ON COLUMN public.businesses.referral_applied_at IS
  'When referral attribution was set. Qualifying referral rewards only count activity after this time.';
COMMENT ON COLUMN public.agents.referral_applied_at IS
  'When referral attribution was set. First-delivery referral credit only counts deliveries after this time.';
