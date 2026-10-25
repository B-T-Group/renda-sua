-- Image cleanup must spend the non-giftable allotment in the same write as
-- ai_tokens. A balance-only decrement violates businesses_ai_tokens_nongiftable_lte_balance
-- whenever the reservation dips into the free floor (signup grant, or the backfill).

CREATE TABLE public.ai_token_hold_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_after integer NOT NULL,
  spent_free integer NOT NULL
);

COMMENT ON TABLE public.ai_token_hold_results IS
  'Return shape for reserve_ai_tokens and settle_ai_cleanup_tokens. Not a ledger.';

CREATE OR REPLACE FUNCTION public.reserve_ai_tokens(
  p_business_id uuid,
  p_amount integer
)
RETURNS SETOF public.ai_token_hold_results
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_tokens integer;
  v_free integer;
  v_spent integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'ai_token_reserve_invalid_amount'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT ai_tokens, ai_tokens_nongiftable
    INTO v_tokens, v_free
    FROM public.businesses
   WHERE id = p_business_id
   FOR NO KEY UPDATE;

  IF NOT FOUND OR v_tokens < p_amount THEN
    RETURN;
  END IF;

  v_spent := LEAST(GREATEST(v_free, 0), p_amount);

  UPDATE public.businesses
     SET ai_tokens = ai_tokens - p_amount,
         ai_tokens_nongiftable = ai_tokens_nongiftable - v_spent,
         updated_at = now()
   WHERE id = p_business_id
     AND ai_tokens >= p_amount
     AND ai_tokens_nongiftable >= v_spent;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT gen_random_uuid(), v_tokens - p_amount, v_spent;
END;
$$;

COMMENT ON FUNCTION public.reserve_ai_tokens(uuid, integer) IS
  'Atomically spend image AI tokens, free allotment first. Empty set means insufficient balance.';

ALTER TABLE public.ai_image_cleanup_jobs
  ADD COLUMN IF NOT EXISTS nongiftable_reserved integer NOT NULL DEFAULT 0;

ALTER TABLE public.ai_image_cleanup_jobs
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_jobs_nongiftable_reserved_nonneg;
ALTER TABLE public.ai_image_cleanup_jobs
  ADD CONSTRAINT ai_image_cleanup_jobs_nongiftable_reserved_nonneg
  CHECK (nongiftable_reserved >= 0);

COMMENT ON COLUMN public.ai_image_cleanup_jobs.nongiftable_reserved IS
  'Free image tokens still held for this job. Success burns them; refund restores them after paid tokens.';

-- p_outcome: consume (success, no balance change) or refund (restore balance).
-- Paid hold is refunded before free tokens. Counters move here so a later
-- status write must not recompute tokens_consumed / tokens_refunded.
CREATE OR REPLACE FUNCTION public.settle_ai_cleanup_tokens(
  p_job_id uuid,
  p_business_id uuid,
  p_amount integer,
  p_outcome text
)
RETURNS SETOF public.ai_token_hold_results
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_business uuid;
  v_reserved integer;
  v_consumed integer;
  v_refunded integer;
  v_free integer;
  v_held integer;
  v_amount integer;
  v_paid integer;
  v_free_part integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT gen_random_uuid(), 0, 0;
    RETURN;
  END IF;

  IF p_outcome IS DISTINCT FROM 'consume' AND p_outcome IS DISTINCT FROM 'refund' THEN
    RAISE EXCEPTION 'ai_cleanup_settle_invalid_outcome'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT business_id, tokens_reserved, tokens_consumed, tokens_refunded, nongiftable_reserved
    INTO v_business, v_reserved, v_consumed, v_refunded, v_free
    FROM public.ai_image_cleanup_jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF NOT FOUND OR v_business IS DISTINCT FROM p_business_id THEN
    RAISE EXCEPTION 'ai_cleanup_settle_job_missing'
      USING ERRCODE = 'no_data_found';
  END IF;

  v_held := GREATEST(0, v_reserved - v_consumed - v_refunded);
  v_amount := LEAST(p_amount, v_held);
  IF v_amount <= 0 THEN
    RETURN QUERY SELECT gen_random_uuid(), 0, 0;
    RETURN;
  END IF;

  v_free := GREATEST(v_free, 0);
  v_paid := GREATEST(0, v_held - v_free);

  IF p_outcome = 'consume' THEN
    v_free_part := LEAST(v_free, v_amount);
    UPDATE public.ai_image_cleanup_jobs
       SET nongiftable_reserved = nongiftable_reserved - v_free_part,
           tokens_consumed = tokens_consumed + v_amount,
           updated_at = now()
     WHERE id = p_job_id;
    RETURN QUERY SELECT gen_random_uuid(), 0, 0;
    RETURN;
  END IF;

  v_free_part := LEAST(v_free, GREATEST(0, v_amount - v_paid));

  UPDATE public.businesses
     SET ai_tokens = ai_tokens + v_amount,
         ai_tokens_nongiftable = ai_tokens_nongiftable + v_free_part,
         updated_at = now()
   WHERE id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ai_cleanup_settle_business_missing'
      USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.ai_image_cleanup_jobs
     SET nongiftable_reserved = nongiftable_reserved - v_free_part,
         tokens_refunded = tokens_refunded + v_amount,
         updated_at = now()
   WHERE id = p_job_id;

  RETURN QUERY SELECT gen_random_uuid(), 0, v_free_part;
END;
$$;

COMMENT ON FUNCTION public.settle_ai_cleanup_tokens(uuid, uuid, integer, text) IS
  'Close part of an image-cleanup token hold. Refunds restore paid tokens first, then the free allotment.';
