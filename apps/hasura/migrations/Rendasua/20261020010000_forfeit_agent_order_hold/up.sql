-- QA F2 (#629 follow-up): agent fault forfeits the agent's hold to the business in ONE
-- transaction.
--
-- Before: release_agent_order_hold (withheld -> available), then a separate 'payment'
-- debit of the agent, then a separate 'deposit' to the business: three transactions.
-- A crash between them left the forfeited money in the agent's available balance (or
-- debited from the agent but never paid to the business), and the money passed
-- through available, where the agent could spend it.
--
-- Now forfeit_agent_order_hold, in one statement-level transaction:
--   1. lock the agent account row FOR NO KEY UPDATE, then the business account row
--      FOR NO KEY UPDATE. Lock order: agent account -> business account, always. No
--      other function locks two account rows (release_agent_order_hold takes only the
--      agent account; AccountsService writes one row per statement), so no cycle.
--   2. once-per-order: if the forfeit row (key failed-delivery:agent-fault:agent-forfeit:
--      <order>) already exists, return it. Its amount is what was moved. If the
--      business credit (key failed-delivery:agent-fault:business-deposit:<order>) is
--      missing (a forfeit written by the old three-step flow that crashed before the
--      deposit), it is written now for exactly that amount. The keys are the old
--      flow's keys, so a retry of an old-flow resolution can never pay twice.
--   3. net held for (agent account, order) = holds - releases - forfeits; amount =
--      round(min(net, p_cap), 2). 0 or less: nothing is written, no row returned.
--   4. withheld -= amount on the agent (never through available), a 'forfeit' ledger
--      row on the agent; available += amount on the business, a 'deposit' row. Both
--      or neither.
-- A concurrent duplicate waits on the agent lock, then finds the forfeit row (step 2)
-- and returns it: the business is credited once. A racing stranded-hold reconciler
-- (release_agent_order_hold, same agent lock) either runs first, so the net here is
-- 0, or after, and then sees the forfeit in its net (it now subtracts forfeits too):
-- total money is conserved either way.
--
-- Withheld smaller than the amount raises agent_hold_release_withheld_short (nothing
-- written), as release_agent_order_hold does.
SET LOCAL lock_timeout = '5s';

ALTER TYPE public.transaction_type_enum ADD VALUE IF NOT EXISTS 'forfeit';

CREATE OR REPLACE FUNCTION public.forfeit_agent_order_hold(
  p_agent_account_id uuid,
  p_business_account_id uuid,
  p_order_id uuid,
  p_cap numeric,
  p_forfeit_memo text,
  p_business_memo text
)
RETURNS SETOF public.account_transactions
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_withheld numeric;
  v_net numeric;
  v_amount numeric;
  v_forfeit public.account_transactions;
  v_forfeit_key text := format('failed-delivery:agent-fault:agent-forfeit:%s', p_order_id);
  v_business_key text := format('failed-delivery:agent-fault:business-deposit:%s', p_order_id);
BEGIN
  IF p_agent_account_id = p_business_account_id THEN
    RAISE EXCEPTION 'agent_forfeit_same_account: %', p_agent_account_id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT withheld_balance INTO v_withheld
    FROM public.accounts WHERE id = p_agent_account_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent_forfeit_account_missing: agent %', p_agent_account_id
      USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM 1 FROM public.accounts WHERE id = p_business_account_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent_forfeit_account_missing: business %', p_business_account_id
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_forfeit FROM public.account_transactions WHERE idempotency_key = v_forfeit_key;
  IF FOUND THEN
    IF v_forfeit.amount > 0 AND NOT EXISTS (
      SELECT 1 FROM public.account_transactions WHERE idempotency_key = v_business_key
    ) THEN
      UPDATE public.accounts
         SET available_balance = available_balance + v_forfeit.amount, updated_at = now()
       WHERE id = p_business_account_id;
      INSERT INTO public.account_transactions
        (account_id, amount, transaction_type, memo, reference_id, idempotency_key)
      VALUES (p_business_account_id, v_forfeit.amount, 'deposit', p_business_memo, p_order_id, v_business_key);
    END IF;
    RETURN NEXT v_forfeit;
    RETURN;
  END IF;

  SELECT coalesce(sum(amount) FILTER (WHERE transaction_type = 'hold'), 0)
           - coalesce(sum(amount) FILTER (WHERE transaction_type IN ('release', 'forfeit')), 0)
    INTO v_net
    FROM public.account_transactions
   WHERE account_id = p_agent_account_id
     AND reference_id = p_order_id
     AND transaction_type IN ('hold', 'release', 'forfeit');

  v_amount := round(least(v_net, coalesce(p_cap, v_net)), 2);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN;
  END IF;
  IF v_withheld < v_amount THEN
    RAISE EXCEPTION 'agent_hold_release_withheld_short: account % withheld % < %',
      p_agent_account_id, v_withheld, v_amount
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.accounts
     SET withheld_balance = withheld_balance - v_amount, updated_at = now()
   WHERE id = p_agent_account_id;
  UPDATE public.accounts
     SET available_balance = available_balance + v_amount, updated_at = now()
   WHERE id = p_business_account_id;
  INSERT INTO public.account_transactions
    (account_id, amount, transaction_type, memo, reference_id, idempotency_key)
  VALUES (p_business_account_id, v_amount, 'deposit', p_business_memo, p_order_id, v_business_key);

  RETURN QUERY
    INSERT INTO public.account_transactions
      (account_id, amount, transaction_type, memo, reference_id, idempotency_key)
    VALUES (p_agent_account_id, v_amount, 'forfeit', p_forfeit_memo, p_order_id, v_forfeit_key)
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION public.forfeit_agent_order_hold(uuid, uuid, uuid, numeric, text, text) IS
  'QA F2: agent fault: min(net held, cap) from agent withheld to the business, forfeit + deposit rows, one transaction, once per order';

-- release_agent_order_hold: a forfeited hold is no longer held, so it leaves the net
-- (otherwise the reconciler would try to release money already paid to the business).
-- Body otherwise unchanged from 20261019230000.
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
           - coalesce(sum(amount) FILTER (WHERE transaction_type IN ('release', 'forfeit')), 0)
    INTO v_holds, v_releases, v_net
    FROM public.account_transactions
   WHERE account_id = p_account_id
     AND reference_id = p_order_id
     AND transaction_type IN ('hold', 'release', 'forfeit');

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
