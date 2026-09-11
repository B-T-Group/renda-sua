#!/usr/bin/env python3
"""Consolidate export_available catalog clones onto Joliette and seed export markets.

Usage:
  ./run.sh prod dry-run
  ./run.sh prod apply
  ./run.sh dev dry-run
  ./run.sh dev apply

Never prints DATABASE_URL. Requires AWS credentials for Secrets Manager.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras

JOLIETTE_LOCATION_ID = "af5af903-55cb-4f80-a2d1-26cc57cc92e3"
EXPORT_MARKETS = ("CM", "GA", "PH")
SECRET_IDS = {
    "prod": "production-rendasua-backend-secrets",
    "dev": "development-rendasua-backend-secrets",
}
REGION = os.environ.get("AWS_REGION", "ca-central-1")


@dataclass
class ItemRow:
    id: str
    business_id: str
    name: str
    sku: str | None
    moderation_status: str
    created_at: Any
    image_count: int = 0
    has_joliette: bool = False
    joliette_inventory_id: str | None = None


@dataclass
class GroupPlan:
    key: str
    canonical: ItemRow
    clones: list[ItemRow] = field(default_factory=list)
    inventory_to_delete: list[str] = field(default_factory=list)
    markets: list[str] = field(default_factory=list)


def load_database_url(env: str) -> str:
    secret_id = SECRET_IDS[env]
    raw = subprocess.check_output(
        [
            "aws",
            "secretsmanager",
            "get-secret-value",
            "--secret-id",
            secret_id,
            "--region",
            REGION,
            "--query",
            "SecretString",
            "--output",
            "text",
        ],
        text=True,
    )
    data = json.loads(raw)
    url = data["DATABASE_URL"]
    host = urlparse(url).hostname
    print(f"Connected env={env} host={host}", file=sys.stderr)
    return url


def group_key(business_id: str, name: str, sku: str | None) -> str:
    if sku and sku.strip():
        return f"{business_id}|sku:{sku.strip().lower()}"
    return f"{business_id}|name:{(name or '').strip().lower()}"


def fetch_export_items(cur) -> list[ItemRow]:
    # Support both pre- and post-rename column names during rollout.
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'items'
          AND column_name IN ('export_available', 'interest_only')
        """
    )
    cols = {r[0] for r in cur.fetchall()}
    if "export_available" in cols:
        flag_col = "export_available"
    elif "interest_only" in cols:
        flag_col = "interest_only"
    else:
        raise RuntimeError("Neither export_available nor interest_only exists on items")

    cur.execute(
        f"""
        SELECT
          i.id,
          i.business_id,
          i.name,
          i.sku,
          i.moderation_status,
          i.created_at,
          COALESCE((
            SELECT COUNT(*)::int FROM item_images img WHERE img.item_id = i.id
          ), 0) AS image_count,
          EXISTS (
            SELECT 1 FROM business_inventory bi
            WHERE bi.item_id = i.id
              AND bi.business_location_id = %s
              AND bi.is_active = true
          ) AS has_joliette,
          (
            SELECT bi.id::text FROM business_inventory bi
            WHERE bi.item_id = i.id
              AND bi.business_location_id = %s
            ORDER BY bi.is_active DESC, bi.created_at ASC
            LIMIT 1
          ) AS joliette_inventory_id
        FROM items i
        WHERE i.{flag_col} = true
          AND i.status = 'active'
        ORDER BY i.created_at ASC
        """,
        (JOLIETTE_LOCATION_ID, JOLIETTE_LOCATION_ID),
    )
    rows = []
    for r in cur.fetchall():
        rows.append(
            ItemRow(
                id=str(r[0]),
                business_id=str(r[1]),
                name=r[2] or "",
                sku=r[3],
                moderation_status=r[4] or "",
                created_at=r[5],
                image_count=int(r[6] or 0),
                has_joliette=bool(r[7]),
                joliette_inventory_id=r[8],
            )
        )
    return rows


def pick_canonical(items: list[ItemRow]) -> ItemRow:
    approved = [i for i in items if i.moderation_status == "approved"]
    pool = approved or items
    with_j = [i for i in pool if i.has_joliette]
    pool = with_j or pool
    pool = sorted(pool, key=lambda i: (-i.image_count, i.created_at))
    return pool[0]


def build_plans(items: list[ItemRow]) -> list[GroupPlan]:
    groups: dict[str, list[ItemRow]] = defaultdict(list)
    for item in items:
        groups[group_key(item.business_id, item.name, item.sku)].append(item)

    plans: list[GroupPlan] = []
    for key, members in groups.items():
        canonical = pick_canonical(members)
        clones = [m for m in members if m.id != canonical.id]
        plans.append(
            GroupPlan(
                key=key,
                canonical=canonical,
                clones=clones,
                markets=list(EXPORT_MARKETS),
            )
        )
    return plans


def ensure_joliette_inventory(cur, item: ItemRow, apply: bool) -> str | None:
    if item.joliette_inventory_id:
        if apply:
            cur.execute(
                """
                UPDATE business_inventory
                SET is_active = true,
                    quantity = GREATEST(quantity, 1),
                    updated_at = now()
                WHERE id = %s
                """,
                (item.joliette_inventory_id,),
            )
        return item.joliette_inventory_id

    # Prefer cloning qty/price from any existing inventory row.
    cur.execute(
        """
        SELECT quantity, selling_price, unit_cost, reorder_point, reorder_quantity
        FROM business_inventory
        WHERE item_id = %s
        ORDER BY is_active DESC, created_at ASC
        LIMIT 1
        """,
        (item.id,),
    )
    src = cur.fetchone()
    qty = max(int(src[0] or 1), 1) if src else 1
    selling = float(src[1] or 0) if src else 0
    unit_cost = float(src[2] or 0) if src else 0
    reorder_point = int(src[3] or 0) if src else 0
    reorder_quantity = int(src[4] or 0) if src else 0

    if not apply:
        return None

    cur.execute(
        """
        INSERT INTO business_inventory (
          business_location_id, item_id, quantity, reserved_quantity,
          reorder_point, reorder_quantity, unit_cost, selling_price, is_active
        ) VALUES (%s, %s, %s, 0, %s, %s, %s, %s, true)
        RETURNING id
        """,
        (
            JOLIETTE_LOCATION_ID,
            item.id,
            qty,
            reorder_point,
            reorder_quantity,
            unit_cost,
            selling,
        ),
    )
    return str(cur.fetchone()[0])


def repoint_fks(cur, clone_id: str, canonical_id: str, canonical_inv: str | None):
    # Soft tables that CASCADE / allow update
    for table, col in (
        ("user_item_likes", "item_id"),
        ("item_collections", "item_id"),
        ("item_tags", "item_id"),
        ("business_item_favorites", "item_id"),
    ):
        cur.execute(
            f"""
            UPDATE {table} t
            SET {col} = %s
            WHERE {col} = %s
              AND NOT EXISTS (
                SELECT 1 FROM {table} x WHERE x.{col} = %s
                  AND (
                    CASE WHEN '{table}' = 'user_item_likes' THEN x.user_id = t.user_id
                         WHEN '{table}' = 'item_collections' THEN x.collection_id = t.collection_id
                         WHEN '{table}' = 'item_tags' THEN x.tag_id = t.tag_id
                         WHEN '{table}' = 'business_item_favorites' THEN x.business_id = t.business_id
                         ELSE false END
                  )
              )
            """,
            (canonical_id, clone_id, canonical_id),
        )
        cur.execute(f"DELETE FROM {table} WHERE {col} = %s", (clone_id,))

    if canonical_inv:
        cur.execute(
            """
            UPDATE product_interest_requests
            SET item_id = %s, business_inventory_id = %s
            WHERE item_id = %s
            """,
            (canonical_id, canonical_inv, clone_id),
        )
    else:
        cur.execute(
            "UPDATE product_interest_requests SET item_id = %s WHERE item_id = %s",
            (canonical_id, clone_id),
        )

    # Images: delete clones after canonical already has images, else re-point
    cur.execute(
        "SELECT COUNT(*) FROM item_images WHERE item_id = %s", (canonical_id,)
    )
    has_images = int(cur.fetchone()[0]) > 0
    if has_images:
        cur.execute("DELETE FROM item_images WHERE item_id = %s", (clone_id,))
    else:
        cur.execute(
            "UPDATE item_images SET item_id = %s WHERE item_id = %s",
            (canonical_id, clone_id),
        )

    # Variants: delete clone variants (unique constraints make merge hard)
    cur.execute("DELETE FROM item_variants WHERE item_id = %s", (clone_id,))


def delete_clone_inventory_and_item(cur, clone_id: str):
    cur.execute(
        "DELETE FROM business_inventory WHERE item_id = %s", (clone_id,)
    )
    cur.execute("DELETE FROM items WHERE id = %s", (clone_id,))


def seed_export_markets(cur, item_id: str, apply: bool):
    # Ensure flag is export_available if column exists
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'items'
          AND column_name IN ('export_available', 'interest_only')
        """
    )
    cols = {r[0] for r in cur.fetchall()}
    if apply and "export_available" in cols:
        cur.execute(
            "UPDATE items SET export_available = true WHERE id = %s", (item_id,)
        )
    elif apply and "interest_only" in cols:
        cur.execute(
            "UPDATE items SET interest_only = true WHERE id = %s", (item_id,)
        )

    cur.execute(
        """
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'item_export_markets'
        )
        """
    )
    if not cur.fetchone()[0]:
        return
    if not apply:
        return
    for code in EXPORT_MARKETS:
        cur.execute(
            """
            INSERT INTO item_export_markets (item_id, country_code)
            VALUES (%s, %s)
            ON CONFLICT (item_id, country_code) DO NOTHING
            """,
            (item_id, code),
        )


def move_non_joliette_inventory(cur, item_id: str, apply: bool) -> list[str]:
    cur.execute(
        """
        SELECT id::text, business_location_id::text
        FROM business_inventory
        WHERE item_id = %s AND business_location_id <> %s
        """,
        (item_id, JOLIETTE_LOCATION_ID),
    )
    rows = cur.fetchall()
    ids = [r[0] for r in rows]
    if apply and ids:
        cur.execute(
            """
            DELETE FROM business_inventory
            WHERE item_id = %s AND business_location_id <> %s
            """,
            (item_id, JOLIETTE_LOCATION_ID),
        )
    return ids


def run(env: str, apply: bool) -> dict[str, Any]:
    url = load_database_url(env)
    conn = psycopg2.connect(url)
    conn.autocommit = False
    report: dict[str, Any] = {
        "env": env,
        "apply": apply,
        "joliette_location_id": JOLIETTE_LOCATION_ID,
        "export_markets": list(EXPORT_MARKETS),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "groups": 0,
        "canonical_kept": 0,
        "clones_deleted": 0,
        "inventory_removed": 0,
        "markets_written": 0,
        "details": [],
    }
    try:
        with conn.cursor() as cur:
            items = fetch_export_items(cur)
            plans = build_plans(items)
            report["groups"] = len(plans)
            for plan in plans:
                detail: dict[str, Any] = {
                    "key": plan.key,
                    "canonical_id": plan.canonical.id,
                    "canonical_name": plan.canonical.name,
                    "clone_ids": [c.id for c in plan.clones],
                    "markets": plan.markets,
                }
                inv_id = ensure_joliette_inventory(cur, plan.canonical, apply)
                detail["joliette_inventory_id"] = inv_id
                removed = move_non_joliette_inventory(
                    cur, plan.canonical.id, apply
                )
                report["inventory_removed"] += len(removed)
                for clone in plan.clones:
                    clone_removed = move_non_joliette_inventory(
                        cur, clone.id, apply
                    )
                    report["inventory_removed"] += len(clone_removed)
                    if apply:
                        repoint_fks(cur, clone.id, plan.canonical.id, inv_id)
                        delete_clone_inventory_and_item(cur, clone.id)
                    report["clones_deleted"] += 1
                seed_export_markets(cur, plan.canonical.id, apply)
                report["markets_written"] += len(plan.markets)
                report["canonical_kept"] += 1
                report["details"].append(detail)
            if apply:
                conn.commit()
            else:
                conn.rollback()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("env", choices=("prod", "dev"))
    parser.add_argument("mode", choices=("dry-run", "apply"))
    args = parser.parse_args()
    if args.env == "prod" and args.mode == "apply":
        confirm = input("Type APPLY-PROD to continue: ").strip()
        if confirm != "APPLY-PROD":
            print("Aborted", file=sys.stderr)
            return 1
    report = run(args.env, apply=(args.mode == "apply"))
    out_dir = os.path.join(os.path.dirname(__file__), "reports")
    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = os.path.join(
        out_dir, f"{args.env}-{args.mode}-{stamp}.json"
    )
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    print(json.dumps({k: v for k, v in report.items() if k != "details"}, indent=2))
    print(f"Wrote {path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
