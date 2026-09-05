#!/usr/bin/env python3
"""
Surgical category cleanup tool for item_categories and item_sub_categories.

CRITICAL: Never delete categories/subcategories with items. Always remap first.
Schema uses ON DELETE RESTRICT.
"""

import argparse
import csv
import json
import logging
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


@dataclass
class CategoryInfo:
    """Category/subcategory row with item counts."""

    id: int
    name: str
    item_count: int
    parent_id: Optional[int] = None
    status: Optional[str] = None


@dataclass
class RemapPlan:
    """Plan to remap from_id → to_id."""

    from_id: int
    to_id: int
    from_name: str
    to_name: str
    item_count: int
    reason: str


class CategoryCleanup:
    """Surgical cleanup for item_categories and item_sub_categories."""

    def __init__(self, dsn: str):
        self.dsn = dsn
        self.conn = None

    def connect(self):
        """Connect to Postgres."""
        if self.conn is None:
            self.conn = psycopg2.connect(self.dsn)
            logger.info(
                "Connected to %s",
                self.conn.info.host or "(localhost)",
            )

    def close(self):
        """Close connection."""
        if self.conn:
            self.conn.close()
            self.conn = None

    def _execute_query(
        self, query: str, params: Optional[tuple] = None
    ) -> List[Dict]:
        """Execute query and return rows as dicts."""
        self.connect()
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]

    def _execute_update(
        self, query: str, params: Optional[tuple] = None
    ) -> int:
        """Execute update/delete and return affected rows."""
        self.connect()
        with self.conn.cursor() as cur:
            cur.execute(query, params)
            return cur.rowcount

    def inventory_categories(self) -> List[CategoryInfo]:
        """Get all categories with item counts (via subcategories → items)."""
        query = """
            SELECT
                c.id,
                c.name,
                c.status,
                COALESCE(SUM(sub_items.item_count), 0)::int AS item_count
            FROM public.item_categories c
            LEFT JOIN public.item_sub_categories s ON s.item_category_id = c.id
            LEFT JOIN (
                SELECT item_sub_category_id, COUNT(*) AS item_count
                FROM public.items
                GROUP BY item_sub_category_id
            ) sub_items ON sub_items.item_sub_category_id = s.id
            GROUP BY c.id, c.name, c.status
            ORDER BY c.id
        """
        rows = self._execute_query(query)
        return [CategoryInfo(**row) for row in rows]

    def inventory_subcategories(self) -> List[CategoryInfo]:
        """Get all subcategories with item counts."""
        query = """
            SELECT
                s.id,
                s.name,
                s.status,
                s.item_category_id AS parent_id,
                COALESCE(items.item_count, 0)::int AS item_count
            FROM public.item_sub_categories s
            LEFT JOIN (
                SELECT item_sub_category_id, COUNT(*) AS item_count
                FROM public.items
                GROUP BY item_sub_category_id
            ) items ON items.item_sub_category_id = s.id
            ORDER BY s.id
        """
        rows = self._execute_query(query)
        return [CategoryInfo(**row) for row in rows]

    def find_duplicates(
        self, items: List[CategoryInfo]
    ) -> Dict[str, List[CategoryInfo]]:
        """Group by normalized name (lower + trim)."""
        groups: Dict[str, List[CategoryInfo]] = defaultdict(list)
        for item in items:
            key = item.name.strip().lower()
            groups[key].append(item)
        return {k: v for k, v in groups.items() if len(v) > 1}

    def find_case_variants(
        self, items: List[CategoryInfo]
    ) -> Dict[str, List[CategoryInfo]]:
        """Find items where normalized name matches but exact name differs."""
        groups: Dict[str, List[CategoryInfo]] = defaultdict(list)
        for item in items:
            key = item.name.strip().lower()
            groups[key].append(item)

        variants = {}
        for key, group in groups.items():
            unique_names = set(item.name for item in group)
            if len(unique_names) > 1:
                variants[key] = group
        return variants

    def find_test_junk(
        self, items: List[CategoryInfo], patterns: Optional[List[str]] = None
    ) -> List[CategoryInfo]:
        """Find likely test/junk entries."""
        if patterns is None:
            patterns = [
                "test",
                "demo",
                "sample",
                "example",
                "xxx",
                "zzz",
                "delete",
                "tmp",
                "temp",
            ]

        candidates = []
        for item in items:
            lower_name = item.name.strip().lower()
            if any(pattern in lower_name for pattern in patterns):
                candidates.append(item)
        return candidates

    def select_canonical(
        self, group: List[CategoryInfo]
    ) -> Tuple[CategoryInfo, List[CategoryInfo]]:
        """
        Select canonical entry from duplicates.

        Rules:
        1. Highest item count
        2. Status: 'active' > 'draft' > others
        3. Title Case preference
        4. Lowest ID as tie-breaker
        """

        def is_title_case(name: str) -> bool:
            """Check if name is Title Case."""
            return name == name.title()

        def status_priority(status: Optional[str]) -> int:
            """Lower = better priority."""
            if status == "active":
                return 0
            elif status == "draft":
                return 1
            else:
                return 2

        sorted_group = sorted(
            group,
            key=lambda x: (
                -x.item_count,
                status_priority(x.status),
                not is_title_case(x.name),
                x.id,
            ),
        )
        return sorted_group[0], sorted_group[1:]

    def plan_remaps(
        self,
        duplicates: Dict[str, List[CategoryInfo]],
        reason_prefix: str = "duplicate",
    ) -> List[RemapPlan]:
        """Generate remap plan from duplicates."""
        plans = []
        for normalized_name, group in duplicates.items():
            canonical, others = self.select_canonical(group)
            for other in others:
                plans.append(
                    RemapPlan(
                        from_id=other.id,
                        to_id=canonical.id,
                        from_name=other.name,
                        to_name=canonical.name,
                        item_count=other.item_count,
                        reason=f"{reason_prefix}: {normalized_name}",
                    )
                )
        return plans

    def remap_items(
        self, from_subcategory_id: int, to_subcategory_id: int, dry_run: bool
    ) -> int:
        """Remap items.item_sub_category_id."""
        query = """
            UPDATE public.items
            SET item_sub_category_id = %s
            WHERE item_sub_category_id = %s
        """
        if dry_run:
            logger.info(
                "[DRY-RUN] Would remap items: %s → %s",
                from_subcategory_id,
                to_subcategory_id,
            )
            count_query = """
                SELECT COUNT(*) AS count
                FROM public.items
                WHERE item_sub_category_id = %s
            """
            rows = self._execute_query(
                count_query, (from_subcategory_id,)
            )
            return rows[0]["count"]
        else:
            count = self._execute_update(
                query, (to_subcategory_id, from_subcategory_id)
            )
            self.conn.commit()
            return count

    def remap_subcategory_parents(
        self, from_category_id: int, to_category_id: int, dry_run: bool
    ) -> int:
        """Remap item_sub_categories.item_category_id."""
        query = """
            UPDATE public.item_sub_categories
            SET item_category_id = %s
            WHERE item_category_id = %s
        """
        if dry_run:
            logger.info(
                "[DRY-RUN] Would remap subcategory parents: %s → %s",
                from_category_id,
                to_category_id,
            )
            count_query = """
                SELECT COUNT(*) AS count
                FROM public.item_sub_categories
                WHERE item_category_id = %s
            """
            rows = self._execute_query(count_query, (from_category_id,))
            return rows[0]["count"]
        else:
            count = self._execute_update(
                query, (to_category_id, from_category_id)
            )
            self.conn.commit()
            return count

    def delete_subcategory(
        self, subcategory_id: int, dry_run: bool
    ) -> bool:
        """Delete empty subcategory."""
        query = "DELETE FROM public.item_sub_categories WHERE id = %s"
        if dry_run:
            logger.info(
                "[DRY-RUN] Would delete subcategory id=%s", subcategory_id
            )
            return True
        else:
            try:
                count = self._execute_update(query, (subcategory_id,))
                self.conn.commit()
                return count > 0
            except psycopg2.IntegrityError as e:
                self.conn.rollback()
                logger.error(
                    "Cannot delete subcategory %s: %s", subcategory_id, e
                )
                return False

    def delete_category(self, category_id: int, dry_run: bool) -> bool:
        """Delete empty category."""
        query = "DELETE FROM public.item_categories WHERE id = %s"
        if dry_run:
            logger.info("[DRY-RUN] Would delete category id=%s", category_id)
            return True
        else:
            try:
                count = self._execute_update(query, (category_id,))
                self.conn.commit()
                return count > 0
            except psycopg2.IntegrityError as e:
                self.conn.rollback()
                logger.error("Cannot delete category %s: %s", category_id, e)
                return False

    def normalize_names(
        self,
        table: str,
        ids: Optional[List[int]] = None,
        dry_run: bool = False,
    ) -> int:
        """Normalize names to Title Case."""
        if table not in ["item_categories", "item_sub_categories"]:
            raise ValueError(f"Invalid table: {table}")

        where = ""
        params = ()
        if ids:
            placeholders = ",".join("%s" for _ in ids)
            where = f"WHERE id IN ({placeholders})"
            params = tuple(ids)

        query = f"""
            UPDATE public.{table}
            SET name = INITCAP(TRIM(name))
            WHERE TRIM(name) != INITCAP(TRIM(name))
            {where}
        """
        if dry_run:
            logger.info("[DRY-RUN] Would normalize names in %s", table)
            count_query = f"""
                SELECT COUNT(*) AS count
                FROM public.{table}
                WHERE TRIM(name) != INITCAP(TRIM(name))
                {where}
            """
            rows = self._execute_query(count_query, params)
            return rows[0]["count"]
        else:
            count = self._execute_update(query, params)
            self.conn.commit()
            return count


def cmd_inventory(args):
    """Generate inventory reports."""
    cleanup = CategoryCleanup(args.dsn)
    try:
        categories = cleanup.inventory_categories()
        subcategories = cleanup.inventory_subcategories()

        cat_file = os.path.join(args.output_dir, "categories.csv")
        sub_file = os.path.join(args.output_dir, "subcategories.csv")

        os.makedirs(args.output_dir, exist_ok=True)

        with open(cat_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f, fieldnames=["id", "name", "status", "item_count"]
            )
            writer.writeheader()
            for cat in categories:
                writer.writerow(
                    {
                        "id": cat.id,
                        "name": cat.name,
                        "status": cat.status or "",
                        "item_count": cat.item_count,
                    }
                )

        with open(sub_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f, fieldnames=["id", "name", "status", "parent_id", "item_count"]
            )
            writer.writeheader()
            for sub in subcategories:
                writer.writerow(
                    {
                        "id": sub.id,
                        "name": sub.name,
                        "status": sub.status or "",
                        "parent_id": sub.parent_id,
                        "item_count": sub.item_count,
                    }
                )

        logger.info("Wrote %s (%d rows)", cat_file, len(categories))
        logger.info("Wrote %s (%d rows)", sub_file, len(subcategories))

        cat_dupes = cleanup.find_duplicates(categories)
        sub_dupes = cleanup.find_duplicates(subcategories)

        cat_dupes_file = os.path.join(args.output_dir, "category_duplicates.csv")
        sub_dupes_file = os.path.join(
            args.output_dir, "subcategory_duplicates.csv"
        )

        with open(cat_dupes_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["normalized_name", "id", "name", "status", "item_count"],
            )
            writer.writeheader()
            for norm_name, group in cat_dupes.items():
                for item in group:
                    writer.writerow(
                        {
                            "normalized_name": norm_name,
                            "id": item.id,
                            "name": item.name,
                            "status": item.status or "",
                            "item_count": item.item_count,
                        }
                    )

        with open(sub_dupes_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "normalized_name",
                    "id",
                    "name",
                    "status",
                    "parent_id",
                    "item_count",
                ],
            )
            writer.writeheader()
            for norm_name, group in sub_dupes.items():
                for item in group:
                    writer.writerow(
                        {
                            "normalized_name": norm_name,
                            "id": item.id,
                            "name": item.name,
                            "status": item.status or "",
                            "parent_id": item.parent_id,
                            "item_count": item.item_count,
                        }
                    )

        logger.info(
            "Wrote %s (%d duplicate groups)",
            cat_dupes_file,
            len(cat_dupes),
        )
        logger.info(
            "Wrote %s (%d duplicate groups)",
            sub_dupes_file,
            len(sub_dupes),
        )

        cat_case = cleanup.find_case_variants(categories)
        sub_case = cleanup.find_case_variants(subcategories)

        cat_case_file = os.path.join(
            args.output_dir, "category_case_variants.csv"
        )
        sub_case_file = os.path.join(
            args.output_dir, "subcategory_case_variants.csv"
        )

        with open(cat_case_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["normalized_name", "id", "name", "status", "item_count"],
            )
            writer.writeheader()
            for norm_name, group in cat_case.items():
                for item in group:
                    writer.writerow(
                        {
                            "normalized_name": norm_name,
                            "id": item.id,
                            "name": item.name,
                            "status": item.status or "",
                            "item_count": item.item_count,
                        }
                    )

        with open(sub_case_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "normalized_name",
                    "id",
                    "name",
                    "status",
                    "parent_id",
                    "item_count",
                ],
            )
            writer.writeheader()
            for norm_name, group in sub_case.items():
                for item in group:
                    writer.writerow(
                        {
                            "normalized_name": norm_name,
                            "id": item.id,
                            "name": item.name,
                            "status": item.status or "",
                            "parent_id": item.parent_id,
                            "item_count": item.item_count,
                        }
                    )

        logger.info(
            "Wrote %s (%d case variant groups)",
            cat_case_file,
            len(cat_case),
        )
        logger.info(
            "Wrote %s (%d case variant groups)",
            sub_case_file,
            len(sub_case),
        )

        cat_junk = cleanup.find_test_junk(categories)
        sub_junk = cleanup.find_test_junk(subcategories)

        cat_junk_file = os.path.join(args.output_dir, "category_test_junk.csv")
        sub_junk_file = os.path.join(
            args.output_dir, "subcategory_test_junk.csv"
        )

        with open(cat_junk_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f, fieldnames=["id", "name", "status", "item_count"]
            )
            writer.writeheader()
            for item in cat_junk:
                writer.writerow(
                    {
                        "id": item.id,
                        "name": item.name,
                        "status": item.status or "",
                        "item_count": item.item_count,
                    }
                )

        with open(sub_junk_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f, fieldnames=["id", "name", "status", "parent_id", "item_count"]
            )
            writer.writeheader()
            for item in sub_junk:
                writer.writerow(
                    {
                        "id": item.id,
                        "name": item.name,
                        "status": item.status or "",
                        "parent_id": item.parent_id,
                        "item_count": item.item_count,
                    }
                )

        logger.info("Wrote %s (%d candidates)", cat_junk_file, len(cat_junk))
        logger.info("Wrote %s (%d candidates)", sub_junk_file, len(sub_junk))

        logger.info("Inventory complete. Output in %s", args.output_dir)

    finally:
        cleanup.close()


def cmd_plan(args):
    """Generate remap plan."""
    cleanup = CategoryCleanup(args.dsn)
    try:
        categories = cleanup.inventory_categories()
        subcategories = cleanup.inventory_subcategories()

        cat_dupes = cleanup.find_duplicates(categories)
        sub_dupes = cleanup.find_duplicates(subcategories)

        cat_plans = cleanup.plan_remaps(cat_dupes, "category_duplicate")
        sub_plans = cleanup.plan_remaps(sub_dupes, "subcategory_duplicate")

        plan_file = os.path.join(args.output_dir, "remap_plan.json")
        os.makedirs(args.output_dir, exist_ok=True)

        plan_data = {
            "category_remaps": [
                {
                    "from_id": p.from_id,
                    "to_id": p.to_id,
                    "from_name": p.from_name,
                    "to_name": p.to_name,
                    "item_count": p.item_count,
                    "reason": p.reason,
                }
                for p in cat_plans
            ],
            "subcategory_remaps": [
                {
                    "from_id": p.from_id,
                    "to_id": p.to_id,
                    "from_name": p.from_name,
                    "to_name": p.to_name,
                    "item_count": p.item_count,
                    "reason": p.reason,
                }
                for p in sub_plans
            ],
        }

        with open(plan_file, "w", encoding="utf-8") as f:
            json.dump(plan_data, f, indent=2, ensure_ascii=False)

        logger.info("Wrote remap plan: %s", plan_file)
        logger.info("Category remaps: %d", len(cat_plans))
        logger.info("Subcategory remaps: %d", len(sub_plans))

        if cat_plans or sub_plans:
            logger.info("\nPlan summary:")
            for plan in cat_plans:
                logger.info(
                    "  Category: %s (%d) → %s (%d) [%d items]",
                    plan.from_name,
                    plan.from_id,
                    plan.to_name,
                    plan.to_id,
                    plan.item_count,
                )
            for plan in sub_plans:
                logger.info(
                    "  Subcategory: %s (%d) → %s (%d) [%d items]",
                    plan.from_name,
                    plan.from_id,
                    plan.to_name,
                    plan.to_id,
                    plan.item_count,
                )

    finally:
        cleanup.close()


def cmd_apply(args):
    """Apply remap plan."""
    cleanup = CategoryCleanup(args.dsn)
    try:
        plan_file = os.path.join(args.output_dir, "remap_plan.json")
        if not os.path.exists(plan_file):
            logger.error("No remap plan found at %s", plan_file)
            logger.error("Run 'plan' command first")
            sys.exit(1)

        with open(plan_file, encoding="utf-8") as f:
            plan_data = json.load(f)

        cat_remaps = plan_data.get("category_remaps", [])
        sub_remaps = plan_data.get("subcategory_remaps", [])

        if args.dry_run:
            logger.info("=== DRY RUN MODE ===")
        else:
            logger.info("=== APPLYING REMAPS ===")

        logger.info("Applying subcategory remaps...")
        for remap in sub_remaps:
            count = cleanup.remap_items(
                remap["from_id"], remap["to_id"], args.dry_run
            )
            logger.info(
                "  Remapped %d items: %s (%d) → %s (%d)",
                count,
                remap["from_name"],
                remap["from_id"],
                remap["to_name"],
                remap["to_id"],
            )

        logger.info("Applying category remaps...")
        for remap in cat_remaps:
            count = cleanup.remap_subcategory_parents(
                remap["from_id"], remap["to_id"], args.dry_run
            )
            logger.info(
                "  Remapped %d subcategories: %s (%d) → %s (%d)",
                count,
                remap["from_name"],
                remap["from_id"],
                remap["to_name"],
                remap["to_id"],
            )

        if args.delete_empty:
            logger.info("Deleting empty subcategories...")
            for remap in sub_remaps:
                if remap["item_count"] == 0 or not args.dry_run:
                    success = cleanup.delete_subcategory(
                        remap["from_id"], args.dry_run
                    )
                    if success:
                        logger.info(
                            "  Deleted subcategory %s (%d)",
                            remap["from_name"],
                            remap["from_id"],
                        )

            logger.info("Deleting empty categories...")
            for remap in cat_remaps:
                if remap["item_count"] == 0 or not args.dry_run:
                    success = cleanup.delete_category(
                        remap["from_id"], args.dry_run
                    )
                    if success:
                        logger.info(
                            "  Deleted category %s (%d)",
                            remap["from_name"],
                            remap["from_id"],
                        )

        if args.dry_run:
            logger.info("=== DRY RUN COMPLETE ===")
        else:
            logger.info("=== REMAPS APPLIED ===")

    finally:
        cleanup.close()


def cmd_normalize(args):
    """Normalize names to Title Case."""
    cleanup = CategoryCleanup(args.dsn)
    try:
        if args.dry_run:
            logger.info("=== DRY RUN MODE ===")
        else:
            logger.info("=== NORMALIZING NAMES ===")

        count_cat = cleanup.normalize_names(
            "item_categories", dry_run=args.dry_run
        )
        logger.info("Categories normalized: %d", count_cat)

        count_sub = cleanup.normalize_names(
            "item_sub_categories", dry_run=args.dry_run
        )
        logger.info("Subcategories normalized: %d", count_sub)

        if args.dry_run:
            logger.info("=== DRY RUN COMPLETE ===")
        else:
            logger.info("=== NORMALIZATION COMPLETE ===")

    finally:
        cleanup.close()


def main():
    parser = argparse.ArgumentParser(
        description="Surgical category cleanup tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dsn",
        default=os.environ.get("DATABASE_URL"),
        help="Postgres connection string (default: DATABASE_URL env var)",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Verbose logging"
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    inventory_parser = subparsers.add_parser(
        "inventory", help="Generate inventory reports"
    )
    inventory_parser.add_argument(
        "--output-dir",
        default="./reports",
        help="Output directory (default: ./reports)",
    )
    inventory_parser.set_defaults(func=cmd_inventory)

    plan_parser = subparsers.add_parser(
        "plan", help="Generate remap plan"
    )
    plan_parser.add_argument(
        "--output-dir",
        default="./reports",
        help="Output directory (default: ./reports)",
    )
    plan_parser.set_defaults(func=cmd_plan)

    apply_parser = subparsers.add_parser(
        "apply", help="Apply remap plan"
    )
    apply_parser.add_argument(
        "--output-dir",
        default="./reports",
        help="Output directory (default: ./reports)",
    )
    apply_parser.add_argument(
        "--dry-run", action="store_true", help="Dry run mode"
    )
    apply_parser.add_argument(
        "--delete-empty",
        action="store_true",
        help="Delete empty categories after remapping",
    )
    apply_parser.set_defaults(func=cmd_apply)

    normalize_parser = subparsers.add_parser(
        "normalize", help="Normalize names to Title Case"
    )
    normalize_parser.add_argument(
        "--dry-run", action="store_true", help="Dry run mode"
    )
    normalize_parser.set_defaults(func=cmd_normalize)

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if not args.dsn:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
