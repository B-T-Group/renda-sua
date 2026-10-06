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
        "status": "active",
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
        # the order's own hold is released in full, then the fee is charged from
        # the released funds (nothing left stranded in withheld)
        self.assertEqual(register_fee.call_args.args[4], 2700.0)
        released = [c.args[1] for c in deps["register_account_transaction"].call_args_list]
        self.assertEqual(released, [9000.0, 1500.0])

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

    # --- #462 / NB-4: never over-release on deposit (PAP/PAD) orders -------------

    def test_deposit_order_without_hold_row_releases_nothing_and_creates_no_hold(self):
        order = _order(
            payment_timing="pay_at_pickup",
            payment_status="pending",
            deposit_status="forfeited",
            deposit_amount=200.0,
            total_amount=800.0,
        )
        with self._patch_cancellation_dependencies(
            order=order, hold=None, transaction_ids=[], held={"client-account-123": 0.0}
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "ready_for_pickup", "endpoint", "secret",
                cancellation_reason="client_no_show",
            )
        self.assertTrue(result["success"])
        self.assertEqual(result["cancellation_fee"], 0.0)
        deps["register_account_transaction"].assert_not_called()
        deps["update_order_hold_status"].assert_not_called()
        self.assertFalse(hasattr(handler, "get_or_create_order_hold"))

    def test_deposit_order_phantom_hold_row_is_capped_by_ledger(self):
        # PAD order E: backend wrote order_holds.client_hold_amount = total - deposit
        # at agent claim, but no client ledger hold exists for the order.
        order = _order(
            payment_timing="pay_at_delivery",
            payment_status="pending",
            deposit_status="paid",
            deposit_amount=200.0,
            total_amount=1300.0,
        )
        with self._patch_cancellation_dependencies(
            order=order,
            hold=_hold(client_hold_amount=1100.0),
            transaction_ids=[],
            held={"client-account-123": 0.0},
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "confirmed", "endpoint", "secret"
            )
        self.assertTrue(result["success"])
        deps["register_account_transaction"].assert_not_called()
        deps["update_order_hold_status"].assert_called_once_with(
            "hold-123", "cancelled", "endpoint", "secret"
        )

    def test_release_is_capped_at_the_ledger_hold_for_the_order(self):
        with self._patch_cancellation_dependencies(
            order=_order(total_amount=800.0),
            hold=_hold(client_hold_amount=800.0),
            transaction_ids=["rel"],
            held={"client-account-123": 300.0},
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "confirmed", "endpoint", "secret"
            )
        self.assertTrue(result["success"])
        released = [c.args[1] for c in deps["register_account_transaction"].call_args_list]
        self.assertEqual(released, [300.0])

    def test_no_hold_row_releases_only_ledger_holds_for_the_order(self):
        with self._patch_cancellation_dependencies(
            order=_order(payment_timing="pay_now", payment_status="paid"),
            hold=None,
            transaction_ids=["rel"],
            held={"client-account-123": 200.0},
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "pending", "endpoint", "secret"
            )
        self.assertTrue(result["success"])
        call = deps["register_account_transaction"].call_args
        self.assertEqual(call.args[1], 200.0)
        self.assertEqual(call.args[2], "release")
        self.assertEqual(call.args[4], "order-123")
        deps["update_order_hold_status"].assert_not_called()

    def test_hold_not_active_is_a_no_op(self):
        with self._patch_cancellation_dependencies(
            order=_order(), hold=_hold(status="cancelled"), transaction_ids=[]
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "pending", "endpoint", "secret"
            )
        self.assertTrue(result["success"])
        self.assertEqual(result.get("skipped"), "hold_not_active")
        deps["register_account_transaction"].assert_not_called()
        deps["get_reference_held_amount"].assert_not_called()
        deps["update_order_hold_status"].assert_not_called()

    def test_releases_use_deterministic_keys_and_held_ignores_own_releases(self):
        order = _order(assigned_agent=SimpleNamespace(user_id="agent-user-123"))
        hold = _hold(client_hold_amount=100.0, delivery_fees=25.0, agent_hold_amount=40.0)
        with self._patch_cancellation_dependencies(
            order=order, hold=hold, transaction_ids=["agent-rel", "client-rel", "delivery-rel"]
        ) as deps:
            result = handler.process_cancellation_financials(
                "order-123", "business", "pending", "endpoint", "secret"
            )
        self.assertTrue(result["success"])
        keys = [
            c.kwargs.get("idempotency_key")
            for c in deps["register_account_transaction"].call_args_list
        ]
        self.assertEqual(
            keys,
            [
                "order:order-123:cancel_release:agent",
                "order:order-123:cancel_release:client",
                "order:order-123:cancel_release:delivery",
            ],
        )
        for c in deps["get_reference_held_amount"].call_args_list:
            self.assertEqual(
                c.kwargs.get("exclude_release_key_prefix"),
                "order:order-123:cancel_release:",
            )

    def test_fee_is_charged_after_release_with_idempotent_fee_keys(self):
        order = _order(payment_timing="pay_now", payment_status="paid", total_amount=200.0)
        calls = []
        with self._patch_cancellation_dependencies(
            order=order, hold=_hold(client_hold_amount=200.0), transaction_ids=["rel"]
        ) as deps:
            deps["register_account_transaction"].side_effect = (
                lambda *a, **k: calls.append(("release", a[1])) or "rel"
            )
            with self._patch_fee_config(country="CM", rows=[
                {"country_code": "CM", "number_value": 30}
            ]), patch.object(
                handler,
                "register_cancellation_fee_transactions",
                side_effect=lambda *a, **k: calls.append(("fee", a[4], k.get("idempotency_key_prefix")))
                or {"success": True},
            ):
                result = handler.process_cancellation_financials(
                    "order-123", "business", "ready_for_pickup", "endpoint", "secret",
                    cancellation_reason="client_no_show",
                )
        self.assertTrue(result["success"])
        self.assertEqual(result["cancellation_fee"], 60.0)
        self.assertEqual(
            calls,
            [("release", 200.0), ("fee", 60.0, "order:order-123:cancel_fee")],
        )

    def test_failed_fee_after_release_fails_step_and_keeps_hold_active(self):
        order = _order(payment_timing="pay_now", payment_status="paid", total_amount=200.0)
        with self._patch_cancellation_dependencies(
            order=order, hold=_hold(client_hold_amount=200.0), transaction_ids=["rel"]
        ) as deps:
            with self._patch_fee_config(country="CM", rows=[
                {"country_code": "CM", "number_value": 30}
            ]), patch.object(
                handler,
                "register_cancellation_fee_transactions",
                return_value={"success": False, "error": "boom"},
            ):
                result = handler.process_cancellation_financials(
                    "order-123", "client", "confirmed", "endpoint", "secret"
                )
        self.assertFalse(result["success"])
        deps["update_order_hold_status"].assert_not_called()

    def test_is_reservation_deposit_order(self):
        self.assertTrue(handler.is_reservation_deposit_order(_order(deposit_status="paid")))
        self.assertTrue(handler.is_reservation_deposit_order(_order(deposit_amount=150.0)))
        self.assertFalse(handler.is_reservation_deposit_order(_order(deposit_status="none")))
        self.assertFalse(handler.is_reservation_deposit_order(_order()))

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
        held=None,
    ):
        client_account = SimpleNamespace(id="client-account-123")

        def get_account(user_id, *_args, **_kwargs):
            if user_id == "agent-user-123":
                return agent_account
            return client_account

        # Ledger amount held per account for this order. Defaults to exactly what
        # the hold row says, i.e. a consistent ledger.
        if held is None:
            held = {
                "client-account-123": (hold.client_hold_amount + hold.delivery_fees) if hold else 0.0,
                "agent-account-123": hold.agent_hold_amount if hold else 0.0,
            }

        def get_held(account_id, *_args, **_kwargs):
            return held.get(account_id, 0.0)

        patches = {
            "get_complete_order_details": patch.object(
                handler, "get_complete_order_details", return_value=order
            ),
            "get_order_hold": patch.object(
                handler, "get_order_hold", return_value=hold
            ),
            "get_reference_held_amount": patch.object(
                handler, "get_reference_held_amount", side_effect=get_held
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
