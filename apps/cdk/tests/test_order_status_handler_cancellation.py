import sys
import unittest
from contextlib import ExitStack
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

    def test_unpaid_pay_after_confirm_skips_cancellation_fee(self):
        order = _order(
            pay_after_merchant_confirm=True,
            payment_status="pending",
        )
        with self._patch_cancellation_dependencies(
            order=order,
            hold=_hold(client_hold_amount=0.0),
            transaction_ids=[],
        ):
            result = handler.process_cancellation_financials(
                "order-123", "client", "confirmed", "endpoint", "secret"
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["cancellation_fee"], 0.0)

    def test_paid_pay_after_confirm_still_charges_cancellation_fee(self):
        order = _order(
            pay_after_merchant_confirm=True,
            payment_status="paid",
            total_amount=5000.0,
        )
        with self._patch_cancellation_dependencies(
            order=order,
            hold=_hold(client_hold_amount=0.0),
            transaction_ids=[],
        ):
            with self._patch_fee_config(country="GA", rows=[
                {"country_code": "GA", "number_value": 30}
            ]), patch.object(
                handler,
                "register_cancellation_fee_transactions",
                return_value={"success": True},
            ) as register_fee:
                result = handler.process_cancellation_financials(
                    "order-123", "client", "confirmed", "endpoint", "secret"
                )

        self.assertTrue(result["success"])
        self.assertEqual(result["cancellation_fee"], 1500.0)
        register_fee.assert_called_once()

    def test_fee_applicability_keys_on_pay_after_flag_not_payment_timing(self):
        # Mirrors cancellation-policy.service.spec.ts "fee applicability matrix".
        # (payment_timing, pay_after, payment_status, previous_status) -> fee applies
        matrix = [
            # pay-after delivery is stored as pay_now; pay-after pickup as pay_at_pickup
            ("pay_now", True, "pending", "confirmed", False),
            ("pay_now", True, "paid", "confirmed", True),
            ("pay_at_pickup", True, "pending", "confirmed", False),
            ("pay_at_pickup", True, "paid", "preparing", True),
            ("pay_at_pickup", True, "authorized", "ready_for_pickup", True),
            # classic pay-at-* never carries a fee
            ("pay_at_pickup", False, "paid", "confirmed", False),
            ("pay_at_delivery", False, "pending", "confirmed", False),
            # classic pay-now carries the fee from confirmed
            ("pay_now", False, "paid", "confirmed", True),
            ("pay_now", False, "paid", "pending", False),
        ]
        for timing, pay_after, payment_status, prev, expected in matrix:
            order = _order(
                payment_timing=timing,
                pay_after_merchant_confirm=pay_after,
                payment_status=payment_status,
            )
            with self.subTest(timing=timing, pay_after=pay_after, status=payment_status, prev=prev):
                self.assertEqual(
                    handler.client_cancellation_fee_applies(order, "client", prev),
                    expected,
                )
        # A plain business cancel is not charged. A ready paid no-show is.
        self.assertFalse(
            handler.client_cancellation_fee_applies(
                _order(payment_timing="pay_now", payment_status="paid"),
                "business",
                "confirmed",
            )
        )
        self.assertTrue(
            handler.client_cancellation_fee_applies(
                _order(payment_timing="pay_now", payment_status="paid"),
                "business",
                "ready_for_pickup",
                "client_no_show",
            )
        )
        self.assertFalse(
            handler.client_cancellation_fee_applies(
                _order(payment_timing="pay_at_pickup", payment_status="pending"),
                "business",
                "ready_for_pickup",
                "client_no_show",
            )
        )

    def test_fee_is_30_percent_of_item_subtotal_excluding_delivery_and_tax(self):
        # items after discount 9000 + delivery 1500 + tax 200 = 10700
        order = _order(
            total_amount=10700.0,
            base_delivery_fee=1000.0,
            per_km_delivery_fee=500.0,
            delivery_fee_waived=False,
            tax_amount=200.0,
        )
        hold = _hold(client_hold_amount=9000.0, delivery_fees=1500.0)
        with self._patch_cancellation_dependencies(
            order=order, hold=hold, transaction_ids=["rel-items", "rel-delivery"]
        ) as deps:
            with self._patch_fee_config(country="Cameroon", rows=[
                {"country_code": "CM", "number_value": 30}
            ]), patch.object(
                handler,
                "register_cancellation_fee_transactions",
                return_value={"success": True},
            ) as register_fee:
                result = handler.process_cancellation_financials(
                    "order-123", "client", "confirmed", "endpoint", "secret"
                )

        self.assertTrue(result["success"])
        self.assertEqual(result["cancellation_fee"], 2700.0)
        # fee charged, then hold released minus the fee, delivery hold released in full
        self.assertEqual(register_fee.call_args.args[4], 2700.0)
        released = [c.args[1] for c in deps["register_account_transaction"].call_args_list]
        self.assertEqual(released, [6300.0, 1500.0])

    def test_canada_explicit_zero_row_charges_nothing(self):
        order = _order(total_amount=100.0, currency="CAD")
        with self._patch_cancellation_dependencies(
            order=order, hold=_hold(client_hold_amount=100.0), transaction_ids=["rel"]
        ):
            with self._patch_fee_config(country="Canada", rows=[
                {"country_code": "CA", "number_value": 0}
            ]), patch.object(
                handler, "register_cancellation_fee_transactions"
            ) as register_fee:
                result = handler.process_cancellation_financials(
                    "order-123", "client", "confirmed", "endpoint", "secret"
                )
        self.assertTrue(result["success"])
        self.assertEqual(result["cancellation_fee"], 0.0)
        register_fee.assert_not_called()

    def test_missing_row_uses_30_default_and_logs_marker(self):
        order = _order(total_amount=1000.0)
        with self._patch_cancellation_dependencies(
            order=order, hold=_hold(client_hold_amount=1000.0), transaction_ids=["rel"]
        ):
            with self._patch_fee_config(country="CM", rows=[]), patch.object(
                handler,
                "register_cancellation_fee_transactions",
                return_value={"success": True},
            ), patch.object(handler, "log_error") as log_error:
                result = handler.process_cancellation_financials(
                    "order-123", "client", "confirmed", "endpoint", "secret"
                )
        self.assertEqual(result["cancellation_fee"], 300.0)
        markers = [c.args[0] for c in log_error.call_args_list]
        self.assertTrue(
            any(m.startswith("cancellation_fee_config_missing") for m in markers), markers
        )

    def test_config_read_error_fails_step_and_does_not_waive_fee(self):
        order = _order(total_amount=1000.0)
        with self._patch_cancellation_dependencies(
            order=order, hold=_hold(client_hold_amount=1000.0), transaction_ids=[]
        ) as deps:
            with patch.object(
                handler,
                "get_order_business_location_country_strict",
                return_value="CM",
            ), patch.object(
                handler,
                "get_cancellation_fee_percent_rows",
                side_effect=RuntimeError("hasura down"),
            ):
                result = handler.process_cancellation_financials(
                    "order-123", "client", "confirmed", "endpoint", "secret"
                )
        self.assertFalse(result["success"])
        deps["update_order_hold_status"].assert_not_called()
        deps["register_account_transaction"].assert_not_called()

    def test_invalid_stored_percent_fails_step(self):
        order = _order(total_amount=1000.0)
        with self._patch_cancellation_dependencies(
            order=order, hold=_hold(), transaction_ids=[]
        ):
            with self._patch_fee_config(country="CM", rows=[
                {"country_code": "CM", "number_value": None}
            ]):
                result = handler.process_cancellation_financials(
                    "order-123", "client", "confirmed", "endpoint", "secret"
                )
        self.assertFalse(result["success"])

    def test_pay_at_delivery_and_pay_at_pickup_never_charge(self):
        for timing in ("pay_at_delivery", "pay_at_pickup"):
            order = _order(payment_timing=timing, total_amount=5000.0)
            with self._patch_cancellation_dependencies(
                order=order, hold=_hold(client_hold_amount=0.0), transaction_ids=[]
            ):
                with patch.object(
                    handler, "get_cancellation_fee_percent_rows"
                ) as rows, patch.object(
                    handler, "register_cancellation_fee_transactions"
                ) as register_fee:
                    result = handler.process_cancellation_financials(
                        "order-123", "client", "confirmed", "endpoint", "secret"
                    )
            self.assertTrue(result["success"], timing)
            self.assertEqual(result["cancellation_fee"], 0.0, timing)
            rows.assert_not_called()
            register_fee.assert_not_called()

    def test_waived_delivery_fee_is_not_subtracted_from_base(self):
        order = _order(
            total_amount=9000.0,
            base_delivery_fee=1000.0,
            per_km_delivery_fee=500.0,
            delivery_fee_waived=True,
        )
        with self._patch_cancellation_dependencies(
            order=order, hold=_hold(client_hold_amount=9000.0), transaction_ids=["rel"]
        ):
            with self._patch_fee_config(country="GA", rows=[
                {"country_code": "GA", "number_value": 30}
            ]), patch.object(
                handler,
                "register_cancellation_fee_transactions",
                return_value={"success": True},
            ):
                result = handler.process_cancellation_financials(
                    "order-123", "client", "confirmed", "endpoint", "secret"
                )
        self.assertEqual(result["cancellation_fee"], 2700.0)

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

    def _patch_fee_config(self, country, rows):
        stack = ExitStack()
        stack.enter_context(
            patch.object(
                handler,
                "get_order_business_location_country_strict",
                return_value=country,
            )
        )
        stack.enter_context(
            patch.object(handler, "get_cancellation_fee_percent_rows", return_value=rows)
        )
        return stack

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
            "resolve_platform_account_id": patch.object(
                handler, "resolve_platform_account_id", return_value="hq-account-1"
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


class RegisterCancellationFeeGuardTests(unittest.TestCase):
    def test_missing_platform_account_does_not_debit_the_client(self):
        from rendasua_core_packages.hasura_client import transactions_service

        with patch.object(transactions_service, "register_account_transaction") as debit:
            result = transactions_service.register_cancellation_fee_transactions(
                "order-1",
                "ORD-1",
                "client-acct",
                "biz-acct",
                1,
                "XAF",
                "http://hasura",
                "secret",
                platform_account_id=None,
            )
        self.assertFalse(result["success"])
        debit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
