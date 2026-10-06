"""Regression: cancellation fee legs need HQ; users.identifier was dropped."""
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
LAMBDA_DIR = WORKSPACE_ROOT / "apps/cdk/src/lambda/order-status-handler"
CORE_PACKAGES_DIR = WORKSPACE_ROOT / "apps/cdk/src/core-packages"
sys.path.insert(0, str(CORE_PACKAGES_DIR))
sys.path.insert(0, str(LAMBDA_DIR))
sys.modules.setdefault("boto3", MagicMock())

import handler  # noqa: E402
from rendasua_core_packages.hasura_client.commission_service import (  # noqa: E402
    get_rendasua_hq_user,
)


class FakeClient:
    def __init__(self, payload=None, error=None):
        self.payload = payload or {}
        self.error = error
        self.queries = []

    def execute(self, query, variables=None):
        self.queries.append(query)
        if self.error:
            raise self.error
        return self.payload


class GetRendasuaHqUserTest(unittest.TestCase):
    def test_query_does_not_select_dropped_identifier(self):
        client = FakeClient(
            {
                "users": [
                    {
                        "id": "hq-1",
                        "user_type_id": "business",
                        "first_name": "Rendasua",
                        "last_name": "HQ",
                        "email": "hq@rendasua.com",
                        "phone_number": "+10000000000",
                        "created_at": "2025-01-01T00:00:00+00:00",
                        "updated_at": "2025-01-01T00:00:00+00:00",
                    }
                ]
            }
        )
        user = get_rendasua_hq_user(client)
        self.assertIsNotNone(user)
        self.assertEqual(user.id, "hq-1")
        self.assertEqual(user.email, "hq@rendasua.com")
        self.assertNotIn("identifier", client.queries[0])

    def test_identifier_validation_error_is_treated_as_missing(self):
        """Pre-fix behaviour: Hasura rejects the query → None → no fee legs."""
        client = FakeClient(
            error=RuntimeError("field 'identifier' not found in type: 'users'")
        )
        self.assertIsNone(get_rendasua_hq_user(client))


class HandleOrderCancelledRetryTest(unittest.TestCase):
    def test_financial_failure_raises_before_slack_or_stripe(self):
        record = {
            "body": (
                '{"eventType":"order.cancelled","orderId":"ord-1",'
                '"timestamp":"2026-10-06T16:00:00Z","cancelledBy":"business",'
                '"cancellationReason":"client_no_show","previousStatus":"ready_for_pickup",'
                '"orderStatus":"cancelled"}'
            )
        }
        with patch.object(handler, "get_hasura_admin_secret", return_value="secret"), \
             patch.dict("os.environ", {"ENVIRONMENT": "development", "GRAPHQL_ENDPOINT": "http://x"}), \
             patch.object(
                 handler,
                 "process_cancellation_financials",
                 return_value={"success": False, "error": "Platform account not found"},
             ) as fin, \
             patch.object(handler, "_send_slack_order_alert_safe") as slack, \
             patch.object(handler, "trigger_stripe_refund_safe") as stripe:
            with self.assertRaises(RuntimeError) as ctx:
                handler.handle_order_cancelled({"Records": [record]})
        self.assertIn("cancel_financials_failed", str(ctx.exception))
        fin.assert_called_once()
        slack.assert_not_called()
        stripe.assert_not_called()

    def test_financial_success_then_slack_and_stripe(self):
        record = {
            "body": (
                '{"eventType":"order.cancelled","orderId":"ord-1",'
                '"timestamp":"2026-10-06T16:00:00Z","cancelledBy":"business",'
                '"cancellationReason":"client_no_show","previousStatus":"ready_for_pickup",'
                '"orderStatus":"cancelled"}'
            )
        }
        with patch.object(handler, "get_hasura_admin_secret", return_value="secret"), \
             patch.dict("os.environ", {"ENVIRONMENT": "development", "GRAPHQL_ENDPOINT": "http://x"}), \
             patch.object(
                 handler,
                 "process_cancellation_financials",
                 return_value={"success": True, "cancellation_fee": 60.0},
             ), \
             patch.object(handler, "_send_slack_order_alert_safe") as slack, \
             patch.object(
                 handler, "trigger_stripe_refund_safe", return_value={"success": True}
             ) as stripe:
            result = handler.handle_order_cancelled({"Records": [record]})
        self.assertTrue(result["success"])
        self.assertEqual(result["cancellation_fee"], 60.0)
        slack.assert_called_once()
        stripe.assert_called_once()


if __name__ == "__main__":
    unittest.main()
