"""Timeout cancel must not void a MoMo row that already left pending."""
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


def _sent(call):
    req = call.args[0]
    return json.loads(req.data.decode("utf-8"))


class CancelMoMoIfPendingTest(unittest.TestCase):
    def _cancel(self, tx, responses=None, urlopen_error=None):
        urlopen_kwargs = (
            {"side_effect": urlopen_error}
            if urlopen_error is not None
            else {"side_effect": responses or []}
        )
        with patch.object(handler, "get_transaction_by_id", return_value=tx), patch.object(
            handler.urllib.request, "urlopen", **urlopen_kwargs
        ) as urlopen:
            result = handler._cancel_momo_tx_if_pending(ROW_ID, ENDPOINT, SECRET)
        return result, urlopen

    def test_missing_row_is_not_cancelled(self):
        result, urlopen = self._cancel(None)
        self.assertFalse(result)
        urlopen.assert_not_called()

    def test_non_pending_rows_are_not_cancelled(self):
        for status in ("processing", "success", "failed", "cancelled"):
            with self.subTest(status=status):
                result, urlopen = self._cancel({"id": ROW_ID, "status": status})
                self.assertFalse(result)
                urlopen.assert_not_called()

    def test_pending_cas_cancels_only_while_still_pending(self):
        body = {"data": {"update_mobile_payment_transactions": {"affected_rows": 1}}}
        result, urlopen = self._cancel({"id": ROW_ID, "status": "pending"}, [_resp(body)])
        self.assertTrue(result)
        sent = _sent(urlopen.call_args)
        self.assertIn('status: { _eq: "pending" }', sent["query"])
        self.assertNotIn("processing", sent["query"])
        self.assertEqual(sent["variables"], {"id": ROW_ID})
        self.assertEqual(urlopen.call_args.args[0].headers["X-hasura-admin-secret"], SECRET)

    def test_pending_cas_lost_returns_false(self):
        body = {"data": {"update_mobile_payment_transactions": {"affected_rows": 0}}}
        result, urlopen = self._cancel({"id": ROW_ID, "status": "pending"}, [_resp(body)])
        self.assertFalse(result)
        urlopen.assert_called_once()

    def test_graphql_errors_return_false(self):
        body = {"errors": [{"message": "field not found"}]}
        result, _urlopen = self._cancel({"id": ROW_ID, "status": "pending"}, [_resp(body)])
        self.assertFalse(result)

    def test_network_error_returns_false(self):
        result, _urlopen = self._cancel(
            {"id": ROW_ID, "status": "pending"},
            urlopen_error=OSError("network down"),
        )
        self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
