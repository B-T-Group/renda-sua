import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
CORE_PACKAGES_DIR = WORKSPACE_ROOT / "apps/cdk/src/core-packages"
sys.path.insert(0, str(CORE_PACKAGES_DIR))

from rendasua_core_packages.hasura_client import accounts_service, transactions_service

ACCOUNT = {"id": "acct-1", "available_balance": 0, "withheld_balance": 500, "total_balance": 500}


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

    def test_new_key_inserts_with_key_and_updates_balances(self):
        result, client = self._run(
            [
                {"account_transactions": []},
                {"accounts_by_pk": ACCOUNT},
                {"insert_account_transactions_one": {"id": "tx-new"}},
                {"update_accounts_by_pk": {"id": "acct-1"}},
            ],
            idempotency_key="order:o1:cancel_release:client",
        )
        self.assertEqual(result, "tx-new")
        insert_vars = client.queries[2][1]
        self.assertEqual(insert_vars["idempotencyKey"], "order:o1:cancel_release:client")
        self.assertEqual(client.queries[3][1]["withheldBalance"], 300)

    def test_concurrent_duplicate_insert_returns_winner_without_balance_update(self):
        result, client = self._run(
            [
                {"account_transactions": []},
                {"accounts_by_pk": ACCOUNT},
                RuntimeError("Uniqueness violation"),
                {"account_transactions": [{"id": "tx-winner"}]},
            ],
            idempotency_key="order:o1:cancel_release:client",
        )
        self.assertEqual(result, "tx-winner")
        self.assertFalse(any("UpdateAccountBalances" in q for q, _ in client.queries))

    def test_without_key_behaves_as_before(self):
        result, client = self._run(
            [
                {"accounts_by_pk": ACCOUNT},
                {"insert_account_transactions_one": {"id": "tx-plain"}},
                {"update_accounts_by_pk": {"id": "acct-1"}},
            ]
        )
        self.assertEqual(result, "tx-plain")
        self.assertIsNone(client.queries[1][1]["idempotencyKey"])

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


if __name__ == "__main__":
    unittest.main()
