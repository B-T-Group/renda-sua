"""End-to-end cancel scenarios against an in-memory ledger.

Runs the real ``process_cancellation_financials`` and the real fee-leg code;
only Hasura I/O is replaced by ``FakeLedger``, which mirrors the Python
``register_account_transaction`` contract (snapshot funds check, UNIQUE
idempotency key => an existing key returns the earlier row and moves nothing).
"""
import sys
import unittest
from contextlib import ExitStack, contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
LAMBDA_DIR = WORKSPACE_ROOT / "apps/cdk/src/lambda/order-status-handler"
CORE_PACKAGES_DIR = WORKSPACE_ROOT / "apps/cdk/src/core-packages"
sys.path.insert(0, str(CORE_PACKAGES_DIR))
sys.path.insert(0, str(LAMBDA_DIR))
sys.modules.setdefault("boto3", MagicMock())

import handler  # noqa: E402
from rendasua_core_packages.hasura_client import transactions_service  # noqa: E402

ORDER_ID = "c6b7f11f-0000-4000-8000-000000000001"
OTHER_REF = "deposit-txn-or-other-order"
CLIENT, BUSINESS, HQ, AGENT_A, AGENT_B = "client-acct", "biz-acct", "hq-acct", "agent-a-acct", "agent-b-acct"
USER_TO_ACCOUNT = {
    "client-user": CLIENT,
    "business-user": BUSINESS,
    "agent-a-user": AGENT_A,
    "agent-b-user": AGENT_B,
}


class FakeLedger:
    def __init__(self):
        self.balances = {}  # account -> [available, withheld]
        self.rows = []
        self.fail_keys = set()  # keys whose next write fails once (simulated outage)

    def seed(self, account, ttype, amount, ref):
        bal = self.balances.setdefault(account, [0.0, 0.0])
        if ttype == "deposit":
            bal[0] += amount
        elif ttype == "hold":
            bal[0] -= amount
            bal[1] += amount
        elif ttype == "release":
            bal[0] += amount
            bal[1] -= amount
        self.rows.append({"account": account, "type": ttype, "amount": amount, "ref": ref, "key": None})

    def register(self, account_id, amount, ttype, memo, ref, _ep, _secret, idempotency_key=None):
        if idempotency_key:
            for i, row in enumerate(self.rows):
                if row["key"] == idempotency_key:
                    return f"tx-{i}"
            if idempotency_key in self.fail_keys:
                self.fail_keys.discard(idempotency_key)
                return None
        bal = self.balances.setdefault(account_id, [0.0, 0.0])
        if ttype == "release" and bal[1] < amount:
            return None
        if ttype in ("fee", "payment", "hold") and bal[0] < amount:
            return None
        delta = {
            "deposit": (amount, 0),
            "release": (amount, -amount),
            "hold": (-amount, amount),
            "fee": (-amount, 0),
            "payment": (-amount, 0),
        }[ttype]
        bal[0] = round(bal[0] + delta[0], 2)
        bal[1] = round(bal[1] + delta[1], 2)
        self.rows.append({"account": account_id, "type": ttype, "amount": amount, "ref": ref, "key": idempotency_key})
        return f"tx-{len(self.rows) - 1}"

    def held(self, account_id, ref, _ep, _secret, exclude_release_key_prefix=None):
        total = 0.0
        for row in self.rows:
            if row["account"] != account_id or row["ref"] != ref:
                continue
            if row["type"] == "hold":
                total += row["amount"]
            elif row["type"] == "release":
                key = row["key"]
                if exclude_release_key_prefix and key and key.startswith(exclude_release_key_prefix):
                    continue
                total -= row["amount"]
        return max(0.0, round(total, 2))

    def bal(self, account):
        return tuple(self.balances.get(account, [0.0, 0.0]))

    def written(self):
        return [r for r in self.rows if r["key"]]


def _order(**overrides):
    defaults = dict(
        id=ORDER_ID,
        order_number="81442684",
        business=SimpleNamespace(user_id="business-user"),
        business_location_id="loc-1",
        client=SimpleNamespace(user_id="client-user"),
        client_id="client-1",
        assigned_agent=None,
        currency="XAF",
        total_amount=200.0,
        base_delivery_fee=0.0,
        per_km_delivery_fee=0.0,
        delivery_fee_waived=False,
        tax_amount=0.0,
        payment_timing="pay_now",
        payment_status="paid",
        payment_source="mobile_payment",
        pay_after_merchant_confirm=False,
        deposit_amount=None,
        deposit_status="none",
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _hold(status="active", **overrides):
    defaults = dict(
        id="hold-1",
        client_hold_amount=200.0,
        agent_hold_amount=0.0,
        delivery_fees=0.0,
        status=status,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class CancelLedgerScenarios(unittest.TestCase):
    def setUp(self):
        self.ledger = FakeLedger()
        self.hold_row = None
        self.status_updates = []

    @contextmanager
    def _env(self, order, percent=30):
        def update_status(hold_id, status, *_a):
            self.status_updates.append((hold_id, status))
            if self.hold_row is not None:
                self.hold_row.status = status
            return True

        def get_account(user_id, *_a, **_k):
            acct = USER_TO_ACCOUNT.get(user_id)
            return SimpleNamespace(id=acct) if acct else None

        with ExitStack() as stack:
            p = lambda name, **kw: stack.enter_context(patch.object(handler, name, **kw))  # noqa: E731
            p("get_complete_order_details", return_value=order)
            p("get_order_hold", side_effect=lambda *_a: self.hold_row)
            p("get_reference_held_amount", side_effect=self.ledger.held)
            p("get_account_by_user_and_currency", side_effect=get_account)
            p("register_account_transaction", side_effect=self.ledger.register)
            p("update_order_hold_status", side_effect=update_status)
            p("get_order_business_location_country_strict", return_value="CM")
            p("get_cancellation_fee_percent_rows",
              return_value=[{"country_code": "CM", "number_value": percent}])
            p("resolve_platform_account_id", return_value=HQ)
            stack.enter_context(patch.object(
                transactions_service, "register_account_transaction", side_effect=self.ledger.register
            ))
            yield

    def _cancel(self, order, cancelled_by, previous_status, reason=None):
        with self._env(order):
            return handler.process_cancellation_financials(
                ORDER_ID, cancelled_by, previous_status, "ep", "secret", cancellation_reason=reason
            )

    # --- pickup no-show, pay-now (QA case 8, order F) --------------------------------

    def test_pay_now_no_show_with_zero_available_releases_then_charges_fee_once(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 990, OTHER_REF)
        L.seed(CLIENT, "hold", 990, OTHER_REF)  # other orders' / deposits' holds
        L.seed(CLIENT, "deposit", 200, "momo-txn")
        L.seed(CLIENT, "hold", 200, ORDER_ID)  # F's own hold
        self.assertEqual(L.bal(CLIENT), (0.0, 1190.0))
        self.hold_row = _hold()
        order = _order()

        first = self._cancel(order, "business", "ready_for_pickup", "client_no_show")
        self.assertTrue(first["success"], first)
        self.assertEqual(first["cancellation_fee"], 60.0)
        self.assertEqual(L.bal(CLIENT), (140.0, 990.0))
        self.assertEqual(L.bal(BUSINESS), (30.0, 0.0))
        self.assertEqual(L.bal(HQ), (30.0, 0.0))
        self.assertEqual(self.hold_row.status, "cancelled")

        # SQS redelivery / duplicate publish of the same cancel: nothing moves again,
        # even though the row is now `cancelled` (exactly-once comes from the keys).
        rows_before = len(L.rows)
        second = self._cancel(order, "business", "ready_for_pickup", "client_no_show")
        self.assertTrue(second["success"], second)
        self.assertEqual(len(L.rows), rows_before)
        self.assertEqual(L.bal(CLIENT), (140.0, 990.0))
        self.assertEqual(L.bal(BUSINESS), (30.0, 0.0))
        self.assertEqual(L.bal(HQ), (30.0, 0.0))
        self.assertEqual(
            sorted(r["key"] for r in L.written()),
            sorted([
                f"order:{ORDER_ID}:cancel_release:client",
                f"order:{ORDER_ID}:cancel_fee:client",
                f"order:{ORDER_ID}:cancel_fee:business",
                f"order:{ORDER_ID}:cancel_fee:platform",
            ]),
        )

    def test_partial_failure_then_retry_completes_without_double_moves(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 200, "momo-txn")
        L.seed(CLIENT, "hold", 200, ORDER_ID)
        self.hold_row = _hold()
        order = _order()
        L.fail_keys.add(f"order:{ORDER_ID}:cancel_fee:business")

        first = self._cancel(order, "business", "ready_for_pickup", "client_no_show")
        self.assertFalse(first["success"])
        self.assertEqual(self.hold_row.status, "active")  # not marked done
        self.assertEqual(L.bal(CLIENT), (140.0, 0.0))  # release + client fee leg landed

        retry = self._cancel(order, "business", "ready_for_pickup", "client_no_show")
        self.assertTrue(retry["success"], retry)
        self.assertEqual(L.bal(CLIENT), (140.0, 0.0))  # fee not charged twice
        self.assertEqual(L.bal(BUSINESS), (30.0, 0.0))
        self.assertEqual(L.bal(HQ), (30.0, 0.0))
        self.assertEqual(self.hold_row.status, "cancelled")

    # --- deposit orders: the backend owns the deposit ---------------------------------

    def test_pap_deposit_no_show_moves_nothing_and_creates_no_row(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 1390, OTHER_REF)
        L.seed(CLIENT, "hold", 1390, OTHER_REF)  # A/B/C deposits under deposit txns, F, ...
        order = _order(
            total_amount=800.0, payment_timing="pay_at_pickup", payment_status="pending",
            deposit_amount=200.0, deposit_status="forfeited",
        )
        result = self._cancel(order, "business", "ready_for_pickup", "client_no_show")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["cancellation_fee"], 0.0)
        self.assertEqual(L.bal(CLIENT), (0.0, 1390.0))  # the old Lambda released 800 here
        self.assertEqual(L.written(), [])
        self.assertEqual(self.status_updates, [])

    def test_pad_phantom_row_from_agent_claim_is_capped_to_zero(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 1190, OTHER_REF)
        L.seed(CLIENT, "hold", 1190, OTHER_REF)
        self.hold_row = _hold(client_hold_amount=1100.0)  # total - deposit, no ledger hold
        order = _order(
            total_amount=1300.0, payment_timing="pay_at_delivery", payment_status="pending",
            deposit_amount=200.0, deposit_status="paid",
        )
        result = self._cancel(order, "client", "assigned_to_agent")
        self.assertTrue(result["success"], result)
        self.assertEqual(L.bal(CLIENT), (0.0, 1190.0))
        self.assertEqual(L.written(), [])
        self.assertEqual(self.hold_row.status, "cancelled")  # phantom row cleaned up

    def test_client_cancel_of_deposit_order_is_fee_free_and_moves_nothing(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 500, OTHER_REF)
        L.seed(CLIENT, "hold", 500, OTHER_REF)
        order = _order(payment_timing="pay_at_pickup", payment_status="pending",
                       deposit_amount=150.0, deposit_status="refunded")
        result = self._cancel(order, "client", "confirmed")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["cancellation_fee"], 0.0)
        self.assertEqual(L.bal(CLIENT), (0.0, 500.0))

    # --- client / business cancel, delivery split --------------------------------------

    def test_client_cancel_delivery_order_releases_items_and_delivery_then_fee(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 10500, "momo-txn")
        L.seed(CLIENT, "hold", 10500, ORDER_ID)
        self.hold_row = _hold(client_hold_amount=9000.0, delivery_fees=1500.0)
        order = _order(total_amount=10500.0, base_delivery_fee=1000.0, per_km_delivery_fee=500.0)
        result = self._cancel(order, "client", "confirmed")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["cancellation_fee"], 2700.0)
        self.assertEqual(L.bal(CLIENT), (7800.0, 0.0))
        self.assertEqual(L.bal(BUSINESS)[0] + L.bal(HQ)[0], 2700.0)

    def test_business_cancel_pay_now_releases_in_full_without_fee(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 200, "momo-txn")
        L.seed(CLIENT, "hold", 200, ORDER_ID)
        self.hold_row = _hold()
        result = self._cancel(_order(), "business", "confirmed")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["cancellation_fee"], 0.0)
        self.assertEqual(L.bal(CLIENT), (200.0, 0.0))

    def test_after_item_settlement_only_the_remaining_delivery_hold_is_released(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 10500, "momo-txn")
        L.seed(CLIENT, "hold", 10500, ORDER_ID)
        L.seed(CLIENT, "release", 9000, ORDER_ID)  # item settlement (then paid to merchant)
        L.balances[CLIENT][0] -= 9000  # the settlement payment leg
        self.hold_row = _hold(client_hold_amount=0.0, delivery_fees=1500.0)
        result = self._cancel(_order(total_amount=10500.0), "business", "picked_up")
        self.assertTrue(result["success"], result)
        self.assertEqual(L.bal(CLIENT), (1500.0, 0.0))

    def test_backend_already_released_the_order_hold_means_nothing_to_do(self):
        # e.g. releaseNetOrderHoldAfterLostPaidCas (unkeyed) ran before the Lambda
        L = self.ledger
        L.seed(CLIENT, "deposit", 300, "momo-txn")
        L.seed(CLIENT, "hold", 200, ORDER_ID)
        L.seed(CLIENT, "release", 200, ORDER_ID)
        L.seed(CLIENT, "hold", 100, OTHER_REF)
        self.hold_row = _hold(client_hold_amount=200.0)
        result = self._cancel(_order(), "business", "confirmed")
        self.assertTrue(result["success"], result)
        self.assertEqual(L.bal(CLIENT), (200.0, 100.0))  # the 100 of another order untouched
        self.assertEqual(L.written(), [])

    # --- agent-dropped orders (row flipped to `cancelled` by the drop) --------------

    def test_agent_dropped_order_still_returns_the_clients_hold_on_cancel(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 200, "momo-txn")
        L.seed(CLIENT, "hold", 200, ORDER_ID)
        L.seed(AGENT_A, "deposit", 50, "topup")
        L.seed(AGENT_A, "hold", 50, ORDER_ID)
        L.seed(AGENT_A, "release", 50, ORDER_ID)  # drop released only the agent part
        self.hold_row = _hold(status="cancelled", agent_hold_amount=50.0)
        result = self._cancel(_order(), "business", "ready_for_pickup")
        self.assertTrue(result["success"], result)
        self.assertEqual(L.bal(CLIENT), (200.0, 0.0))  # PR head skipped this: 200 stuck held
        self.assertEqual(L.bal(AGENT_A), (50.0, 0.0))
        self.assertEqual(self.status_updates, [])  # never rewrite a non-active row

    def test_dropped_then_reclaimed_order_releases_new_agent_and_client(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 200, "momo-txn")
        L.seed(CLIENT, "hold", 200, ORDER_ID)
        L.seed(AGENT_B, "deposit", 80, "topup")
        L.seed(AGENT_B, "hold", 80, ORDER_ID)
        self.hold_row = _hold(status="cancelled", agent_hold_amount=80.0)
        order = _order(assigned_agent=SimpleNamespace(user_id="agent-b-user"))
        result = self._cancel(order, "client", "assigned_to_agent")
        self.assertTrue(result["success"], result)
        self.assertEqual(L.bal(AGENT_B), (80.0, 0.0))
        # no fee from assigned_to_agent (fee window is confirmed..ready_for_pickup)
        self.assertEqual(L.bal(CLIENT), (200.0, 0.0))

    # --- card ---------------------------------------------------------------------------

    def test_captured_card_order_behaves_like_wallet_hold(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 200, "stripe-txn")  # creditWalletForCapturedOrder
        L.seed(CLIENT, "hold", 200, ORDER_ID)  # finalizeClientOrderPayment
        self.hold_row = _hold()
        order = _order(payment_source="credit_card", currency="XAF")
        result = self._cancel(order, "client", "confirmed")
        self.assertTrue(result["success"], result)
        # 140 left in available = what the Stripe refund (total - fee) then withdraws
        self.assertEqual(L.bal(CLIENT), (140.0, 0.0))

    def test_uncaptured_card_fee_without_released_funds_is_flagged(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 500, "unrelated-topup")
        self.hold_row = _hold(client_hold_amount=200.0)  # no ledger hold behind it
        order = _order(payment_source="credit_card", payment_status="authorized",
                       pay_after_merchant_confirm=True)
        with patch.object(handler, "log_error") as log_error:
            result = self._cancel(order, "client", "confirmed")
        self.assertTrue(result["success"], result)
        events = [c.args[0] for c in log_error.call_args_list]
        self.assertIn("cancel_fee_exceeds_released", events)
        self.assertIn("cancel_release_capped", events)  # non-deposit order: anomaly

    def test_ledger_holding_more_than_the_row_is_flagged_not_released(self):
        L = self.ledger
        L.seed(CLIENT, "deposit", 300, "momo-txn")
        L.seed(CLIENT, "hold", 300, ORDER_ID)
        self.hold_row = _hold(client_hold_amount=200.0)
        with patch.object(handler, "log_error") as log_error:
            result = self._cancel(_order(), "business", "confirmed")
        self.assertTrue(result["success"], result)
        self.assertEqual(L.bal(CLIENT), (200.0, 100.0))
        self.assertIn(
            "cancel_release_ledger_exceeds_row", [c.args[0] for c in log_error.call_args_list]
        )

    def test_platform_account_missing_fails_after_release_without_fee_legs(self):
        """QA case 8 failure mode: release posts, fee cannot (no HQ), hold stays active."""
        L = self.ledger
        L.seed(CLIENT, "deposit", 200, "momo-txn")
        L.seed(CLIENT, "hold", 200, ORDER_ID)
        self.hold_row = _hold()
        order = _order()

        with self._env(order):
            with patch.object(handler, "resolve_platform_account_id", return_value=None):
                result = handler.process_cancellation_financials(
                    ORDER_ID, "business", "ready_for_pickup", "ep", "secret",
                    cancellation_reason="client_no_show",
                )

        self.assertFalse(result["success"])
        self.assertIn("Platform account", result["error"])
        # Release landed; fee legs did not; hold still active for a retry.
        self.assertEqual(L.bal(CLIENT), (200.0, 0.0))
        self.assertEqual(L.bal(BUSINESS), (0.0, 0.0))
        self.assertEqual(L.bal(HQ), (0.0, 0.0))
        self.assertEqual(self.hold_row.status, "active")
        self.assertEqual(
            [r["key"] for r in L.written()],
            [f"order:{ORDER_ID}:cancel_release:client"],
        )

    def test_fee_posts_after_release_at_zero_available(self):
        """Fee is charged from the just-released funds, not pre-release available."""
        L = self.ledger
        L.seed(CLIENT, "deposit", 200, "momo-txn")
        L.seed(CLIENT, "hold", 200, ORDER_ID)
        self.assertEqual(L.bal(CLIENT), (0.0, 200.0))  # available 0
        self.hold_row = _hold()
        order = _order()

        result = self._cancel(order, "business", "ready_for_pickup", "client_no_show")
        self.assertTrue(result["success"], result)
        self.assertEqual(result["cancellation_fee"], 60.0)
        # release 200 then fee 60 => available 140
        self.assertEqual(L.bal(CLIENT), (140.0, 0.0))
        self.assertEqual(L.bal(BUSINESS), (30.0, 0.0))
        self.assertEqual(L.bal(HQ), (30.0, 0.0))
        self.assertEqual(self.hold_row.status, "cancelled")
        keys = [r["key"] for r in L.written()]
        # Release key must appear before fee keys in write order.
        self.assertEqual(keys[0], f"order:{ORDER_ID}:cancel_release:client")
        self.assertIn(f"order:{ORDER_ID}:cancel_fee:client", keys)



if __name__ == "__main__":
    unittest.main()
