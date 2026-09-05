#!/usr/bin/env python3
"""
Unit tests for category_cleanup.py logic.

Run: python3 test_cleanup.py
"""

import unittest
from category_cleanup import CategoryCleanup, CategoryInfo


class TestCategoryCleanup(unittest.TestCase):
    """Test category cleanup logic."""

    def test_find_duplicates(self):
        """Test duplicate detection."""
        items = [
            CategoryInfo(id=1, name="Electronics", item_count=10),
            CategoryInfo(id=2, name="electronics", item_count=5),
            CategoryInfo(id=3, name="  ELECTRONICS  ", item_count=3),
            CategoryInfo(id=4, name="Clothing", item_count=20),
        ]

        cleanup = CategoryCleanup(dsn="")
        dupes = cleanup.find_duplicates(items)

        self.assertEqual(len(dupes), 1)
        self.assertIn("electronics", dupes)
        self.assertEqual(len(dupes["electronics"]), 3)

    def test_find_case_variants(self):
        """Test case variant detection."""
        items = [
            CategoryInfo(id=1, name="Electronics", item_count=10),
            CategoryInfo(id=2, name="electronics", item_count=5),
            CategoryInfo(id=3, name="Clothing", item_count=20),
            CategoryInfo(id=4, name="Clothing", item_count=15),
        ]

        cleanup = CategoryCleanup(dsn="")
        variants = cleanup.find_case_variants(items)

        self.assertEqual(len(variants), 1)
        self.assertIn("electronics", variants)
        self.assertEqual(len(variants["electronics"]), 2)

    def test_find_test_junk(self):
        """Test junk detection."""
        items = [
            CategoryInfo(id=1, name="Test Category", item_count=0),
            CategoryInfo(id=2, name="Demo Items", item_count=1),
            CategoryInfo(id=3, name="Electronics", item_count=10),
            CategoryInfo(id=4, name="xxx-temp", item_count=0),
        ]

        cleanup = CategoryCleanup(dsn="")
        junk = cleanup.find_test_junk(items)

        self.assertEqual(len(junk), 3)
        junk_ids = {item.id for item in junk}
        self.assertEqual(junk_ids, {1, 2, 4})

    def test_select_canonical_highest_count(self):
        """Test canonical selection by item count."""
        group = [
            CategoryInfo(id=1, name="electronics", item_count=5),
            CategoryInfo(id=2, name="Electronics", item_count=10),
            CategoryInfo(id=3, name="ELECTRONICS", item_count=3),
        ]

        cleanup = CategoryCleanup(dsn="")
        canonical, others = cleanup.select_canonical(group)

        self.assertEqual(canonical.id, 2)
        self.assertEqual(len(others), 2)

    def test_select_canonical_title_case_preference(self):
        """Test canonical selection by Title Case when counts are equal."""
        group = [
            CategoryInfo(id=1, name="electronics", item_count=10),
            CategoryInfo(id=2, name="Electronics", item_count=10),
            CategoryInfo(id=3, name="ELECTRONICS", item_count=10),
        ]

        cleanup = CategoryCleanup(dsn="")
        canonical, others = cleanup.select_canonical(group)

        self.assertEqual(canonical.id, 2)
        self.assertEqual(canonical.name, "Electronics")

    def test_select_canonical_lowest_id_tiebreaker(self):
        """Test canonical selection by lowest ID as final tie-breaker."""
        group = [
            CategoryInfo(id=3, name="electronics", item_count=10),
            CategoryInfo(id=1, name="ELECTRONICS", item_count=10),
            CategoryInfo(id=2, name="eLECTRONICS", item_count=10),
        ]

        cleanup = CategoryCleanup(dsn="")
        canonical, others = cleanup.select_canonical(group)

        self.assertEqual(canonical.id, 1)

    def test_plan_remaps(self):
        """Test remap plan generation."""
        duplicates = {
            "electronics": [
                CategoryInfo(id=1, name="Electronics", item_count=10),
                CategoryInfo(id=2, name="electronics", item_count=5),
                CategoryInfo(id=3, name="ELECTRONICS", item_count=3),
            ],
        }

        cleanup = CategoryCleanup(dsn="")
        plans = cleanup.plan_remaps(duplicates, "test")

        self.assertEqual(len(plans), 2)
        canonical_id = 1
        from_ids = {plan.from_id for plan in plans}
        self.assertEqual(from_ids, {2, 3})
        for plan in plans:
            self.assertEqual(plan.to_id, canonical_id)


if __name__ == "__main__":
    unittest.main()
