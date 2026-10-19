-- #622 (PE blocker): release an agent's hold on one order in ONE transaction.
--
-- Before: the backend read the net (holds - releases) in one call, then AccountsService
-- moved the balance and wrote the ledger row in two more. A live release
-- (creditHoldRelease) and the stranded-hold reconciler could both read the same net
-- and both credit it, and a reader could see the balance moved before its ledger row.
--
-- Now, in one statement-level transaction:
--   1. lock the agent's account row FOR NO KEY UPDATE;
--   2. compute the net held for (account, order) from account_transactions;
--   3. credit min(net, p_cap): the balance UPDATE and the ledger INSERT together.
-- A concurrent call for the same account waits on step 1 and then sees the first
-- call's committed ledger row, so the net it computes is already reduced: a strand
-- is credited exactly once whichever caller wins. Other orders' holds on the same
-- account are not part of the net and are untouched.
--
-- Lock order: this function takes only the account row (then writes that row and
-- inserts a child ledger row, whose FK check needs KEY SHARE on the same row, which
-- this transaction already covers). It takes no agents / orders / business_locations
-- lock, so it cannot form a cycle with the dedicated claim, cap trigger or accept
-- functions (agents -> orders, business_locations -> agents). FOR NO KEY UPDATE, not
-- FOR UPDATE, so ledger inserts by other writers on this account (FK KEY SHARE) are
-- not blocked by the lock itself.
--
-- Idempotency: p_idempotency_key, when given, is honoured (UNIQUE
-- account_transactions.idempotency_key): an existing row with that key -> nothing
-- credited. When NULL, the key is derived under the lock from the ledger state,
-- agent-hold-release:<order>:<account>:h<#holds>:r<#releases>, so a retry of the same
-- state is a no-op too.
--
-- Returns the ledger row it wrote, or no row when nothing was credited (net <= 0, or
-- the key already exists). A withheld balance smaller than the amount raises
-- agent_hold_release_withheld_short (nothing written).
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.release_agent_order_hold(
  p_account_id uuid,
  p_order_id uuid,
  p_cap numeric,
  p_idempotency_key text,
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

  v_key := coalesce(
    nullif(p_idempotency_key, ''),
    format('agent-hold-release:%s:%s:h%s:r%s', p_order_id, p_account_id, v_holds, v_releases)
  );
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

COMMENT ON FUNCTION public.release_agent_order_hold(uuid, uuid, numeric, text, text) IS
  '#622: release min(net held, cap) of an agent hold on one order; account row lock, balance + ledger in one transaction';
