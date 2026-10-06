import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
CORE_PACKAGES_DIR = WORKSPACE_ROOT / "apps/cdk/src/core-packages"
sys.path.insert(0, str(CORE_PACKAGES_DIR))

from rendasua_core_packages.hasura_client import (
    accounts_service,
    order_holds_service,
    transactions_service,
)

ACCOUNT = {"id": "acct-1", "available_balance": 0, "withheld_balance": 500, "total_balance": 500}


def _move(tx_id, available, withheld):
    """Response of the single insert + update_accounts request."""
    return {
        "insert_account_transactions_one": {"id": tx_id},
        "update_accounts": {
            "affected_rows": 1,
            "returning": [{"available_balance": available, "withheld_balance": withheld}],
        },
    }


def _client(responses):
    """HasuraClient double: each execute() call pops a response (dict or Exception)."""
    client = MagicMock()

    def execute(query, variables):
        client.queries.append((query, variables))
        r = responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    client.queries = []
    client.execute.side_effect = execute
    return client


class RegisterAccountTransactionIdempotencyTests(unittest.TestCase):
    def _run(self, responses, **kwargs):
        client = _client(responses)
        with patch.object(accounts_service, "HasuraClient", return_value=client):
            result = accounts_service.register_account_transaction(
                "acct-1", 200, "release", "memo", "order-1", "http://h", "s", **kwargs
            )
        return result, client

    def test_existing_key_returns_existing_row_and_moves_nothing(self):
        result, client = self._run(
            [{"account_transactions": [{"id": "tx-existing"}]}],
            idempotency_key="order:o1:cancel_release:client",
        )
        self.assertEqual(result, "tx-existing")
        self.assertEqual(len(client.queries), 1)  # no account read, insert or balance update

    def test_new_key_inserts_row_and_increments_balance_in_one_request(self):
        result, client = self._run(
            [
                {"account_transactions": []},
                {"accounts_by_pk": ACCOUNT},
                _move("tx-new", available=200, withheld=300),
            ],
            idempotency_key="order:o1:cancel_release:client",
        )
        self.assertEqual(result, "tx-new")
        self.assertEqual(len(client.queries), 3)
        query, variables = client.queries[2]
        # one request => one Postgres transaction: row + balance move land together
        self.assertIn("insert_account_transactions_one", query)
        self.assertIn("update_accounts", query)
        self.assertIn("_inc: $inc", query)
        # never an absolute _set of balances computed from a stale snapshot
        self.assertNotIn("available_balance: $availableBalance", query)
        self.assertEqual(variables["idempotencyKey"], "order:o1:cancel_release:client")
        self.assertEqual(variables["inc"], {"available_balance": 200, "withheld_balance": -200})

    def test_concurrent_duplicate_insert_returns_winner_and_sends_no_second_move(self):
        result, client = self._run(
            [
                {"account_transactions": []},
                {"accounts_by_pk": ACCOUNT},
                RuntimeError("Uniqueness violation account_transactions_idempotency_key_key"),
                {"account_transactions": [{"id": "tx-winner"}]},
            ],
            idempotency_key="order:o1:cancel_release:client",
        )
        self.assertEqual(result, "tx-winner")
        # the failed request was the only write attempt; it rolled back as a whole
        writes = [q for q, _ in client.queries if "RegisterLedgerMove" in q]
        self.assertEqual(len(writes), 1)

    def test_failed_move_without_key_reports_failure(self):
        result, client = self._run(
            [{"accounts_by_pk": ACCOUNT}, RuntimeError("Hasura error")],
        )
        self.assertIsNone(result)

    def test_without_key_still_uses_atomic_request(self):
        result, client = self._run(
            [
                {"accounts_by_pk": ACCOUNT},
                _move("tx-plain", available=200, withheld=300),
            ]
        )
        self.assertEqual(result, "tx-plain")
        self.assertIsNone(client.queries[1][1]["idempotencyKey"])
        self.assertIn("update_accounts", client.queries[1][0])

    def test_incomplete_payload_is_not_reported_as_success(self):
        result, _ = self._run(
            [
                {"account_transactions": []},
                {"accounts_by_pk": ACCOUNT},
                {"insert_account_transactions_one": {"id": "tx"}, "update_accounts": {"affected_rows": 0}},
            ],
            idempotency_key="k",
        )
        self.assertIsNone(result)

    def test_negative_balance_after_move_is_logged(self):
        with patch.object(accounts_service, "log_error") as log_error:
            result, _ = self._run(
                [
                    {"account_transactions": []},
                    {"accounts_by_pk": ACCOUNT},
                    _move("tx", available=200, withheld=-50),
                ],
                idempotency_key="k",
            )
        self.assertEqual(result, "tx")
        self.assertIn(
            "ledger_balance_negative_after_move",
            [c.args[0] for c in log_error.call_args_list],
        )

    def test_insufficient_withheld_still_refuses_release(self):
        poor = dict(ACCOUNT, withheld_balance=100)
        result, client = self._run(
            [{"account_transactions": []}, {"accounts_by_pk": poor}],
            idempotency_key="k",
        )
        self.assertIsNone(result)
        self.assertEqual(len(client.queries), 2)


class ReferenceHeldAmountTests(unittest.TestCase):
    def _run(self, response, **kwargs):
        client = _client([response])
        with patch.object(accounts_service, "HasuraClient", return_value=client):
            value = accounts_service.get_reference_held_amount(
                "acct-1", "order-1", "http://h", "s", **kwargs
            )
        return value, client

    def test_net_of_holds_minus_releases(self):
        value, _ = self._run({
            "holds": {"aggregate": {"sum": {"amount": "350"}}},
            "releases": {"aggregate": {"sum": {"amount": "50"}}},
        })
        self.assertEqual(value, 300.0)

    def test_no_rows_is_zero_and_never_negative(self):
        value, _ = self._run({
            "holds": {"aggregate": {"sum": {"amount": None}}},
            "releases": {"aggregate": {"sum": {"amount": "300"}}},
        })
        self.assertEqual(value, 0.0)

    def test_exclude_prefix_filters_own_keyed_releases(self):
        _, client = self._run(
            {
                "holds": {"aggregate": {"sum": {"amount": "200"}}},
                "releases": {"aggregate": {"sum": {"amount": "0"}}},
            },
            exclude_release_key_prefix="order:o1:cancel_release:",
        )
        query, variables = client.queries[0]
        self.assertIn("_nlike: $excludePattern", query)
        self.assertIn("_is_null: true", query)
        self.assertEqual(variables["excludePattern"], "order:o1:cancel_release:%")

    def test_hasura_error_propagates(self):
        client = _client([RuntimeError("Hasura error")])
        with patch.object(accounts_service, "HasuraClient", return_value=client):
            with self.assertRaises(RuntimeError):
                accounts_service.get_reference_held_amount("a", "o", "http://h", "s")


class CancellationFeeKeyTests(unittest.TestCase):
    def test_each_fee_leg_gets_a_deterministic_key(self):
        with patch.object(
            transactions_service, "register_account_transaction", return_value="tx"
        ) as reg:
            result = transactions_service.register_cancellation_fee_transactions(
                "order-1", "ORD-1", "client-acct", "biz-acct", 60, "XAF",
                "http://h", "s",
                platform_account_id="hq-acct",
                idempotency_key_prefix="order:order-1:cancel_fee",
            )
        self.assertTrue(result["success"])
        keys = [c.kwargs.get("idempotency_key") for c in reg.call_args_list]
        self.assertEqual(
            keys,
            [
                "order:order-1:cancel_fee:client",
                "order:order-1:cancel_fee:business",
                "order:order-1:cancel_fee:platform",
            ],
        )


class GetOrderHoldTests(unittest.TestCase):
    ROW = {
        "id": "h1", "order_id": "o1", "client_id": "c1", "agent_id": None,
        "client_hold_amount": "200", "agent_hold_amount": "0", "delivery_fees": None,
        "currency": "XAF", "status": "cancelled",
        "created_at": "2026-10-06T16:00:00Z", "updated_at": "2026-10-06T16:00:00Z",
    }

    def _run(self, response):
        client = _client([response])
        with patch.object(order_holds_service, "HasuraClient", return_value=client):
            return order_holds_service.get_order_hold("o1", "http://h", "s"), client

    def test_returns_none_and_never_inserts_when_no_row(self):
        hold, client = self._run({"order_holds": []})
        self.assertIsNone(hold)
        self.assertEqual(len(client.queries), 1)
        self.assertNotIn("insert_order_holds", client.queries[0][0])

    def test_returns_row_with_status_and_numeric_amounts(self):
        hold, _ = self._run({"order_holds": [self.ROW]})
        self.assertEqual(hold.status, "cancelled")
        self.assertEqual(hold.client_hold_amount, 200.0)
        self.assertEqual(hold.delivery_fees, 0.0)

    def test_hasura_error_propagates_so_the_cancel_fails_closed(self):
        client = _client([RuntimeError("Hasura error")])
        with patch.object(order_holds_service, "HasuraClient", return_value=client):
            with self.assertRaises(RuntimeError):
                order_holds_service.get_order_hold("o1", "http://h", "s")


if __name__ == "__main__":
    unittest.main()
