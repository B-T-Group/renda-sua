-- Hasura tracks a function only when it returns a composite type.
-- Replace the integer close with the booking row it closed.
-- 20261119190000 stays as applied. This file does not edit it.
SET LOCAL lock_timeout = '3s';

DROP FUNCTION IF EXISTS public.close_decline_refund(
  uuid, uuid, text, text, text, uuid, numeric, text, text, uuid, text, text
);

CREATE FUNCTION public.close_decline_refund(
  p_booking_id uuid,
  p_token uuid,
  p_status text,
  p_provider text,
  p_provider_ref text,
  p_account_id uuid,
  p_amount numeric,
  p_memo text,
  p_idempotency_key text,
  p_changed_by uuid,
  p_notes text,
  p_previous_status text
) RETURNS SETOF public.rental_bookings
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_rows integer;
  v_debt numeric;
  v_repay numeric;
  v_rest numeric;
  v_now timestamptz := now();
BEGIN
  PERFORM 1
    FROM public.rental_bookings
   WHERE id = p_booking_id
     AND refund_status = 'refund_pending'
     AND refund_claim_token = p_token
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF COALESCE(p_amount, 0) > 0 THEN
    IF p_account_id IS NULL THEN
      RAISE EXCEPTION 'decline_refund_account_missing' USING ERRCODE = 'check_violation';
    END IF;
    PERFORM 1 FROM public.accounts WHERE id = p_account_id FOR UPDATE;
    SELECT COALESCE(cash_advance_balance, 0) INTO v_debt
      FROM public.accounts WHERE id = p_account_id;
    v_repay := 0;
    v_rest := p_amount;
    IF v_debt < 0 THEN
      v_repay := LEAST(p_amount, abs(v_debt));
      v_rest := round(p_amount - v_repay, 2);
    END IF;
    IF v_repay > 0 AND NOT EXISTS (
      SELECT 1 FROM public.account_transactions
      WHERE idempotency_key = p_idempotency_key || ':repay'
    ) THEN
      UPDATE public.accounts
         SET cash_advance_balance = cash_advance_balance + v_repay, updated_at = v_now
       WHERE id = p_account_id;
      INSERT INTO public.account_transactions
        (account_id, amount, transaction_type, memo, reference_id, idempotency_key)
      VALUES (
        p_account_id, v_repay, 'cash_advance_repayment',
        'Cash advance repayment - ' || COALESCE(p_memo, ''),
        p_booking_id, p_idempotency_key || ':repay'
      );
    END IF;
    IF v_rest > 0 AND NOT EXISTS (
      SELECT 1 FROM public.account_transactions WHERE idempotency_key = p_idempotency_key
    ) THEN
      UPDATE public.accounts
         SET available_balance = available_balance + v_rest, updated_at = v_now
       WHERE id = p_account_id;
      INSERT INTO public.account_transactions
        (account_id, amount, transaction_type, memo, reference_id, idempotency_key)
      VALUES (p_account_id, v_rest, 'deposit', p_memo, p_booking_id, p_idempotency_key);
    END IF;
    UPDATE public.rental_bookings
       SET refund_credited_at = v_now
     WHERE id = p_booking_id AND refund_credited_at IS NULL;
  END IF;

  UPDATE public.rental_bookings
     SET refund_status = p_status,
         refund_status_at = v_now,
         refund_provider = COALESCE(NULLIF(p_provider, ''), refund_provider),
         refund_provider_ref = CASE
           WHEN NULLIF(btrim(COALESCE(p_provider_ref, '')), '') IS NULL THEN refund_provider_ref
           ELSE p_provider_ref
         END,
         refunded_at = CASE WHEN p_status = 'refunded' THEN v_now ELSE refunded_at END,
         refund_claim_at = NULL,
         refund_claim_token = NULL
   WHERE id = p_booking_id
     AND refund_status = 'refund_pending'
     AND refund_claim_token = p_token;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'decline_refund_claim_lost';
  END IF;

  INSERT INTO public.rental_status_history (
    rental_booking_id, status, previous_status, changed_by_user_id, changed_by_type, notes
  ) VALUES (
    p_booking_id,
    'cancelled',
    NULLIF(p_previous_status, '')::public.rental_booking_status_enum,
    p_changed_by,
    'system',
    p_notes
  );

  RETURN QUERY
    SELECT * FROM public.rental_bookings WHERE id = p_booking_id;
END;
$$;

COMMENT ON FUNCTION public.close_decline_refund(
  uuid, uuid, text, text, text, uuid, numeric, text, text, uuid, text, text
) IS
  'Credits a decline refund, closes the claim, and writes the audit row in one transaction. Returns the closed booking, or no row when the claim was lost.';
