-- QA F2 ROLLBACK: revert the backend (FailedDeliveriesService.forfeitAgentHold) first,
-- then the Hasura metadata (functions/public_forfeit_agent_order_hold.yaml and its
-- functions.yaml entry), then run this. The 'forfeit' enum value stays (Postgres cannot
-- drop an enum value); after rollback no code writes it. Forfeit rows already written
-- stay valid ledger history, but the restored release_agent_order_hold no longer
-- subtracts them: resolve any open stranded-hold alert for those orders by hand.
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.forfeit_agent_order_hold(uuid, uuid, uuid, numeric, text, text);

-- release_agent_order_hold as in 20261019230000 (net = holds - releases).
CREATE OR REPLACE FUNCTION public.release_agent_order_hold(
  p_account_id uuid,
  p_order_id uuid,
  p_cap numeric,
  p_memo text
)
RETURNS SETOF public.account_transactions
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_withheld numeric;
  v_holds integer;
  v_releases integer;
  v_net numeric;
  v_amount numeric;
  v_key text;
BEGIN
  SELECT withheld_balance INTO v_withheld
    FROM public.accounts WHERE id = p_account_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent_hold_release_account_missing: %', p_account_id
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT count(*) FILTER (WHERE transaction_type = 'hold'),
         count(*) FILTER (WHERE transaction_type = 'release'),
         coalesce(sum(amount) FILTER (WHERE transaction_type = 'hold'), 0)
           - coalesce(sum(amount) FILTER (WHERE transaction_type = 'release'), 0)
    INTO v_holds, v_releases, v_net
    FROM public.account_transactions
   WHERE account_id = p_account_id
     AND reference_id = p_order_id
     AND transaction_type IN ('hold', 'release');

  v_key := format('agent-hold-release:%s:%s:h%s:r%s', p_order_id, p_account_id, v_holds, v_releases);
  IF EXISTS (SELECT 1 FROM public.account_transactions WHERE idempotency_key = v_key) THEN
    RETURN;
  END IF;

  v_amount := round(least(v_net, coalesce(p_cap, v_net)), 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN;
  END IF;
  IF v_withheld < v_amount THEN
    RAISE EXCEPTION 'agent_hold_release_withheld_short: account % withheld % < %',
      p_account_id, v_withheld, v_amount
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.accounts
     SET available_balance = available_balance + v_amount,
         withheld_balance = withheld_balance - v_amount,
         updated_at = now()
   WHERE id = p_account_id;

  RETURN QUERY
    INSERT INTO public.account_transactions
      (account_id, amount, transaction_type, memo, reference_id, idempotency_key)
    VALUES (p_account_id, v_amount, 'release', p_memo, p_order_id, v_key)
    RETURNING *;
END;
$$;
