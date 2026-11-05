import json
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

import handler


def _rec(mid, event_type, order_id="order-1"):
    return {
        "messageId": mid,
        "body": json.dumps(
            {"eventType": event_type, "orderId": order_id, "timestamp": "2026-11-04T00:00:00Z"}
        ),
    }


class OrderStatusHandlerBatchFailuresTest(unittest.TestCase):
    def test_all_success_returns_empty_failures(self):
        with patch.object(handler, "handle_order_status_updated", return_value={"success": True}) as h:
            res = handler.handler(
                {"Records": [_rec("m1", "order.status.updated"), _rec("m2", "order.status.updated", "order-2")]},
                None,
            )
        self.assertEqual(res, {"batchItemFailures": []})
        self.assertEqual(h.call_count, 2)

    def test_cancel_financials_failure_reports_it_and_remaining_only(self):
        def cancelled(_event):
            raise RuntimeError("cancel_financials_failed: release failed")

        with patch.object(handler, "handle_order_status_updated", return_value={"success": True}) as upd, \
                patch.object(handler, "handle_order_cancelled", side_effect=cancelled):
            res = handler.handler(
                {
                    "Records": [
                        _rec("m1", "order.status.updated"),
                        _rec("m2", "order.cancelled", "order-2"),
                        _rec("m3", "order.status.updated", "order-2"),
                    ]
                },
                None,
            )
        self.assertEqual(res, {"batchItemFailures": [{"itemIdentifier": "m2"}, {"itemIdentifier": "m3"}]})
        # m1 succeeded and is not retried; m3 was not processed ahead of m2 (FIFO order).
        self.assertEqual(upd.call_count, 1)

    def test_non_retryable_errors_are_not_reported(self):
        with patch.object(handler, "handle_order_completed", side_effect=ValueError("boom")):
            res = handler.handler(
                {"Records": [_rec("m1", "order.completed"), {"messageId": "m2", "body": "not json"}, _rec("m3", "order.unknown")]},
                None,
            )
        self.assertEqual(res, {"batchItemFailures": []})

    def test_no_records(self):
        self.assertEqual(handler.handler({"Records": []}, None), {"batchItemFailures": []})


if __name__ == "__main__":
    unittest.main()
