import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
LAMBDA_DIR = WORKSPACE_ROOT / "apps/cdk/src/lambda/order-status-handler"
CORE_PACKAGES_DIR = WORKSPACE_ROOT / "apps/cdk/src/core-packages"
sys.path.insert(0, str(CORE_PACKAGES_DIR))
sys.path.insert(0, str(LAMBDA_DIR))

sys.modules.setdefault("boto3", MagicMock())

import handler


def _order(**overrides):
    defaults = {
        "id": "order-123",
        "order_number": "ORD-123",
        "business": SimpleNamespace(user_id="business-user-123"),
        "business_location_id": "location-123",
        "client": SimpleNamespace(user_id="client-user-123"),
        "client_id": "client-123",
        "assigned_agent": None,
        "currency": "XAF",
        "total_amount": 100.0,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _hold(**overrides):
    defaults = {
        "id": "hold-123",
        "client_hold_amount": 100.0,
        "agent_hold_amount": 0.0,
        "delivery_fees": 0.0,
        "item_settlement_completed_at": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class CancellationFinancialsTest(unittest.TestCase):
    def test_failed_client_release_does_not_cancel_hold(self):
        with self._patch_cancellation_dependencies(
            order=_order(),
            hold=_hold(),
            transaction_ids=[None],
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "pending", "endpoint", "secret"
            )

        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Failed to release: client hold")
        deps["update_order_hold_status"].assert_not_called()

    def test_successful_releases_cancel_hold(self):
        with self._patch_cancellation_dependencies(
            order=_order(),
            hold=_hold(delivery_fees=25.0),
            transaction_ids=["client-release", "delivery-release"],
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "pending", "endpoint", "secret"
            )

        self.assertTrue(result["success"])
        deps["update_order_hold_status"].assert_called_once_with(
            "hold-123", "cancelled", "endpoint", "secret"
        )

    def test_missing_agent_account_does_not_cancel_hold(self):
        order = _order(assigned_agent=SimpleNamespace(user_id="agent-user-123"))
        hold = _hold(agent_hold_amount=40.0, client_hold_amount=0.0)

        with self._patch_cancellation_dependencies(
            order=order,
            hold=hold,
            agent_account=None,
            transaction_ids=[],
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "pending", "endpoint", "secret"
            )

        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Failed to release: agent hold")
        deps["update_order_hold_status"].assert_not_called()

    def _patch_cancellation_dependencies(
        self,
        order,
        hold,
        transaction_ids,
        agent_account=SimpleNamespace(id="agent-account-123"),
    ):
        client_account = SimpleNamespace(id="client-account-123")

        def get_account(user_id, *_args, **_kwargs):
            if user_id == "agent-user-123":
                return agent_account
            return client_account

        patches = {
            "get_complete_order_details": patch.object(
                handler, "get_complete_order_details", return_value=order
            ),
            "get_or_create_order_hold": patch.object(
                handler, "get_or_create_order_hold", return_value=hold
            ),
            "get_account_by_user_and_currency": patch.object(
                handler, "get_account_by_user_and_currency", side_effect=get_account
            ),
            "register_account_transaction": patch.object(
                handler,
                "register_account_transaction",
                side_effect=transaction_ids,
            ),
            "update_order_hold_status": patch.object(
                handler, "update_order_hold_status", return_value=True
            ),
        }
        return _PatchGroup(patches)


class _PatchGroup:
    def __init__(self, patches):
        self._patches = patches
        self._mocks = {}

    def __enter__(self):
        for name, dependency_patch in self._patches.items():
            self._mocks[name] = dependency_patch.__enter__()
        return self._mocks

    def __exit__(self, exc_type, exc_value, traceback):
        for dependency_patch in reversed(self._patches.values()):
            dependency_patch.__exit__(exc_type, exc_value, traceback)


if __name__ == "__main__":
    unittest.main()
