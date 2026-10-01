import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(WORKSPACE_ROOT / "apps/cdk/src/core-packages"))
sys.modules.setdefault("boto3", MagicMock())

from rendasua_core_packages.utilities.cancellation_fee import (  # noqa: E402
    InvalidFeePercentError,
    item_subtotal_after_discounts,
    normalize_fee_country_code,
    percent_fee,
    select_fee_percent,
)


class PercentFeeParityVectors(unittest.TestCase):
    """Same vectors as apps/backend/src/orders/fee-percent.util.spec.ts"""

    VECTORS = [
        (10000, 30, "XAF", 3000),
        (3333, 30, "XAF", 1000),  # 999.9 -> 1000
        (1005, 30, "XAF", 302),  # 301.5 -> 302 (half-up)
        (10.05, 30, "CAD", 3.02),  # 3.015 -> 3.02 (half-up)
        (100, 0, "CAD", 0),
        (0, 30, "XAF", 0),
        (2500, 12.5, "XAF", 313),  # 312.5 -> 313
    ]

    def test_vectors(self):
        for base, pct, cur, expected in self.VECTORS:
            with self.subTest(base=base, pct=pct, cur=cur):
                self.assertEqual(percent_fee(base, pct, cur), expected)


class ItemSubtotal(unittest.TestCase):
    def test_excludes_delivery_and_tax(self):
        self.assertEqual(
            item_subtotal_after_discounts(10700, 1000, 500, False, 200), 9000
        )

    def test_waived_delivery_not_subtracted(self):
        self.assertEqual(item_subtotal_after_discounts(9000, 1000, 500, True, 0), 9000)

    def test_never_negative_and_handles_strings(self):
        self.assertEqual(item_subtotal_after_discounts("1000", "1500", "0"), 0)
        self.assertEqual(item_subtotal_after_discounts("x"), 0)


class CountryAndConfig(unittest.TestCase):
    def test_normalize_country(self):
        for raw, expected in [
            ("CM", "CM"), ("ga", "GA"), ("Cameroon", "CM"), ("Gabon", "GA"),
            ("Canada", "CA"), ("Narnia", None), ("", None), (None, None),
        ]:
            self.assertEqual(normalize_fee_country_code(raw), expected, raw)

    def test_explicit_zero_country_row_wins(self):
        rows = [{"country_code": "CA", "number_value": 0}, {"country_code": None, "number_value": 25}]
        self.assertEqual(select_fee_percent(rows, "CA"), (0.0, "country"))

    def test_global_fallback(self):
        self.assertEqual(
            select_fee_percent([{"country_code": None, "number_value": 25}], "TG"),
            (25.0, "global"),
        )

    def test_missing_default(self):
        self.assertEqual(select_fee_percent([], "CM"), (30.0, "missing_default"))
        self.assertEqual(select_fee_percent([], None), (30.0, "missing_default"))

    def test_invalid_values_raise(self):
        for bad in (None, "", "abc", -1, 101):
            with self.subTest(bad=bad), self.assertRaises(InvalidFeePercentError):
                select_fee_percent([{"country_code": "CM", "number_value": bad}], "CM")


if __name__ == "__main__":
    unittest.main()
