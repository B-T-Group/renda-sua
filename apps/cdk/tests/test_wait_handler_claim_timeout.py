"""Tests for wait-handler order.claim_initiated timeout emit (Phase 0 #453)."""
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
LAMBDA_DIR = WORKSPACE_ROOT / "apps/cdk/src/lambda/wait-handler"
CORE_PACKAGES_DIR = WORKSPACE_ROOT / "apps/cdk/src/core-packages"
sys.path.insert(0, str(CORE_PACKAGES_DIR))
sys.path.insert(0, str(LAMBDA_DIR))

sys.modules.setdefault("boto3", MagicMock())

sys.modules.pop("handler", None)
import handler  # noqa: E402

ROW_ID = "11111111-2222-3333-4444-555555555555"
ORDER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
ENDPOINT = "https://hasura.example/v1/graphql"
SECRET = "secret"


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
        return False


def _resp(body):
    return _Resp(json.dumps(body).encode("utf-8"))


def _tx_data(agent=True):
    user = {"agent": {"id": "agent-1"}} if agent else {"agent": None}
    return {
        "data": {
            "mobile_payment_transactions_by_pk": {
                "transaction_id": "prov-tx-9",
                "amount": 8000,
                "currency": "XAF",
                "provider": "mtn_momo_cm",
                "account_id": "acct-1",
                "account": {"user": user},
            },
            "orders_by_pk": {"order_number": "ORD-1"},
        }
    }


def _sent(call):
    req = call.args[0]
    return json.loads(req.data.decode("utf-8"))


class ClaimTimeoutEmitTest(unittest.TestCase):
    def _run(self, was_cancelled, responses):
        with patch.object(
            handler, "_cancel_momo_tx_if_pending", return_value=was_cancelled
        ) as cancel, patch.object(
            handler.urllib.request, "urlopen", side_effect=responses
        ) as urlopen:
            result = handler._handle_order_claim_initiated(
                {}, ORDER_ID, ROW_ID, ENDPOINT, SECRET
            )
        cancel.assert_called_once_with(ROW_ID, ENDPOINT, SECRET)
        self.assertTrue(result["success"])
        return urlopen

    def test_no_emit_when_tx_was_not_cancelled(self):
        urlopen = self._run(False, [])
        urlopen.assert_not_called()

    def test_looks_up_by_row_primary_key_and_emits_backend_keys(self):
        urlopen = self._run(
            True, [_resp(_tx_data()), _resp({"data": {"insert_site_events_one": {"id": "e1"}}})]
        )
        self.assertEqual(urlopen.call_count, 2)
        lookup = _sent(urlopen.call_args_list[0])
        self.assertIn("mobile_payment_transactions_by_pk(id: $id)", lookup["query"])
        self.assertIn("$id: uuid!", lookup["query"])
        self.assertEqual(lookup["variables"], {"id": ROW_ID, "orderId": ORDER_ID})

        insert = _sent(urlopen.call_args_list[1])["variables"]["object"]
        self.assertEqual(insert["event_type"], "agent.claim_topup_failed")
        self.assertEqual(insert["viewer_type"], "server")
        self.assertEqual(
            insert["metadata"],
            {
                "orderId": ORDER_ID,
                "orderNumber": "ORD-1",
                "agentId": "agent-1",
                "holdAmount": 8000,
                "transactionId": "prov-tx-9",
                "provider": "mtn_momo_cm",
                "currency": "XAF",
                "reason": "timeout",
            },
        )

    def test_logs_and_skips_when_tx_or_order_missing(self):
        with patch.object(handler, "log_error") as log_error:
            urlopen = self._run(
                True,
                [_resp({"data": {"mobile_payment_transactions_by_pk": None, "orders_by_pk": None}})],
            )
        self.assertEqual(urlopen.call_count, 1)
        self.assertTrue(
            any("transaction or order not found" in c.args[0] for c in log_error.call_args_list)
        )

    def test_skips_when_agent_not_resolved(self):
        urlopen = self._run(True, [_resp(_tx_data(agent=False))])
        self.assertEqual(urlopen.call_count, 1)

    def test_graphql_errors_are_caught(self):
        with patch.object(handler, "log_error") as log_error:
            urlopen = self._run(True, [_resp({"errors": [{"message": "field not found"}]})])
        self.assertEqual(urlopen.call_count, 1)
        self.assertTrue(
            any("Failed to emit timeout site_event" in c.args[0] for c in log_error.call_args_list)
        )

    def test_insert_errors_and_network_errors_are_caught(self):
        with patch.object(handler, "log_error") as log_error:
            self._run(True, [_resp(_tx_data()), _resp({"errors": [{"message": "denied"}]})])
            self._run(True, OSError("network down"))
        failures = [c for c in log_error.call_args_list if "Failed to emit" in c.args[0]]
        self.assertEqual(len(failures), 2)


if __name__ == "__main__":
    unittest.main()
