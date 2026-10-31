"""#594 PR 6 (AC-A8): wait-handler routes order.dedicated_heads_up_reping to the Nest internal endpoint."""
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

ORDER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


class DedicatedHeadsUpRepingRouteTest(unittest.TestCase):
    def test_routes_to_the_internal_endpoint_with_the_order_id(self):
        with patch.object(handler, "_get_hasura_config", return_value=("e", "s")), patch.object(
            handler, "_call_backend_internal", return_value={"success": True}
        ) as call:
            result = handler.handler(
                {
                    "event_type": "order.dedicated_heads_up_reping",
                    "payload": {"order_id": ORDER_ID},
                    "run_at": "2026-10-19T10:30:00Z",
                },
                None,
            )
        self.assertEqual(result, {"success": True})
        call.assert_called_once_with(
            "dedicated-heads-up-reping", {"orderId": ORDER_ID}, "Dedicated heads-up re-ping"
        )

    def test_missing_order_id_does_not_call_the_backend(self):
        with patch.object(handler, "_get_hasura_config", return_value=("e", "s")), patch.object(
            handler, "_call_backend_internal", return_value={"success": True}
        ) as call:
            result = handler.handler(
                {
                    "event_type": "order.dedicated_heads_up_reping",
                    "payload": {"order_id": ""},
                    "run_at": "2026-10-19T10:30:00Z",
                },
                None,
            )
        self.assertEqual(result, {"success": False, "error": "Missing order_id"})
        call.assert_not_called()


if __name__ == "__main__":
    unittest.main()
