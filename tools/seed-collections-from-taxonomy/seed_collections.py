#!/usr/bin/env python3
"""Seed platform collections from top categories/subcategories + refresh thin essentials."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras
import requests

REPORTS = Path(__file__).resolve().parent / "reports"
JUNK_NAMES = {"t", "test", "other", "autre", "autres", "misc", "n/a", "na"}
ITEMS_PER_COLLECTION = 8
FEATURED_NEW_COUNT = 10
TOP_CATEGORIES = 15
TOP_SUBCATEGORIES = 12
MIN_LISTINGS_FOR_SEED = 8
ESSENTIAL_KEYWORD_HINTS: dict[str, list[str]] = {
    "baby-essentials": ["bébé", "bebe", "baby", "enfant", "kids", "couche", "diaper"],
    "cleaning-essentials": [
        "ménage",
        "menage",
        "clean",
        "lessive",
        "detergent",
        "savon",
        "hygiène",
        "hygiene",
    ],
    "back-to-school-essentials": [
        "école",
        "ecole",
        "school",
        "cahier",
        "stylo",
        "crayon",
        "sac d'école",
        "fourniture",
    ],
}


@dataclass
class ProposedCollection:
    slug: str
    name_en: str
    name_fr: str
    description_en: str
    description_fr: str
    is_featured: bool
    sort_order: int
    source: str  # category | subcategory | essentials-refresh
    source_id: int | None
    item_ids: list[str]


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:80] or "collection"


def title_en_from_fr(name: str) -> str:
    # Keep FR retail names readable in EN when we lack a separate EN field.
    return name.strip()


def connect():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    return psycopg2.connect(url)


def hasura_headers() -> dict[str, str]:
    secret = os.environ.get("HASURA_ADMIN_SECRET")
    if not secret:
        raise SystemExit("HASURA_ADMIN_SECRET is required")
    return {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": secret,
    }


def hasura_url() -> str:
    base = os.environ.get("HASURA_URL", "").rstrip("/")
    if not base:
        raise SystemExit("HASURA_URL is required")
    return f"{base}/v1/graphql"


def gql(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    resp = requests.post(
        hasura_url(),
        headers=hasura_headers(),
        json={"query": query, "variables": variables or {}},
        timeout=60,
    )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"], indent=2))
    return payload["data"]


def fetch_top_categories(cur, limit: int) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT c.id, c.name, COUNT(DISTINCT bi.id) AS listing_count
        FROM item_categories c
        JOIN item_sub_categories sc ON sc.item_category_id = c.id
        JOIN items i ON i.item_sub_category_id = sc.id
        JOIN business_inventory bi ON bi.item_id = i.id
        JOIN business_locations bl ON bl.id = bi.business_location_id
        JOIN businesses b ON b.id = bl.business_id
        WHERE bi.is_active = true
          AND COALESCE(bi.quantity, 0) > 0
          AND i.is_active = true
          AND COALESCE(c.status, 'active') = 'active'
          AND length(trim(c.name)) > 1
          AND lower(trim(c.name)) <> ALL(%s)
          AND b.is_storefront_visible = true
        GROUP BY c.id, c.name
        HAVING COUNT(DISTINCT bi.id) >= %s
        ORDER BY listing_count DESC
        LIMIT %s
        """,
        (list(JUNK_NAMES), MIN_LISTINGS_FOR_SEED, limit),
    )
    return [
        {"id": r[0], "name": r[1], "listing_count": r[2], "kind": "category"}
        for r in cur.fetchall()
    ]


def fetch_top_subcategories(cur, limit: int) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT sc.id, sc.name, c.name AS category_name, COUNT(DISTINCT bi.id) AS listing_count
        FROM item_sub_categories sc
        JOIN item_categories c ON c.id = sc.item_category_id
        JOIN items i ON i.item_sub_category_id = sc.id
        JOIN business_inventory bi ON bi.item_id = i.id
        JOIN business_locations bl ON bl.id = bi.business_location_id
        JOIN businesses b ON b.id = bl.business_id
        WHERE bi.is_active = true
          AND COALESCE(bi.quantity, 0) > 0
          AND i.is_active = true
          AND COALESCE(sc.status, 'active') = 'active'
          AND length(trim(sc.name)) > 1
          AND lower(trim(sc.name)) <> ALL(%s)
          AND b.is_storefront_visible = true
        GROUP BY sc.id, sc.name, c.name
        HAVING COUNT(DISTINCT bi.id) >= %s
        ORDER BY listing_count DESC
        LIMIT %s
        """,
        (list(JUNK_NAMES), MIN_LISTINGS_FOR_SEED, limit),
    )
    return [
        {
            "id": r[0],
            "name": r[1],
            "category_name": r[2],
            "listing_count": r[3],
            "kind": "subcategory",
        }
        for r in cur.fetchall()
    ]


def sample_item_ids_for_category(cur, category_id: int, limit: int) -> list[str]:
    cur.execute(
        """
        SELECT i.id::text
        FROM items i
        JOIN item_sub_categories sc ON sc.id = i.item_sub_category_id
        JOIN business_inventory bi ON bi.item_id = i.id
        JOIN business_locations bl ON bl.id = bi.business_location_id
        JOIN businesses b ON b.id = bl.business_id
        WHERE sc.item_category_id = %s
          AND i.is_active = true
          AND bi.is_active = true
          AND COALESCE(bi.quantity, 0) > 0
          AND b.is_storefront_visible = true
        GROUP BY i.id
        ORDER BY COUNT(bi.id) DESC, i.created_at DESC
        LIMIT %s
        """,
        (category_id, limit),
    )
    return [r[0] for r in cur.fetchall()]


def sample_item_ids_for_subcategory(cur, subcategory_id: int, limit: int) -> list[str]:
    cur.execute(
        """
        SELECT i.id::text
        FROM items i
        JOIN business_inventory bi ON bi.item_id = i.id
        JOIN business_locations bl ON bl.id = bi.business_location_id
        JOIN businesses b ON b.id = bl.business_id
        WHERE i.item_sub_category_id = %s
          AND i.is_active = true
          AND bi.is_active = true
          AND COALESCE(bi.quantity, 0) > 0
          AND b.is_storefront_visible = true
        GROUP BY i.id
        ORDER BY COUNT(bi.id) DESC, i.created_at DESC
        LIMIT %s
        """,
        (subcategory_id, limit),
    )
    return [r[0] for r in cur.fetchall()]


def sample_items_by_keywords(cur, keywords: list[str], limit: int) -> list[str]:
    patterns = [f"%{k}%" for k in keywords]
    cur.execute(
        """
        SELECT i.id::text
        FROM items i
        JOIN item_sub_categories sc ON sc.id = i.item_sub_category_id
        JOIN item_categories c ON c.id = sc.item_category_id
        JOIN business_inventory bi ON bi.item_id = i.id
        JOIN business_locations bl ON bl.id = bi.business_location_id
        JOIN businesses b ON b.id = bl.business_id
        WHERE i.is_active = true
          AND bi.is_active = true
          AND COALESCE(bi.quantity, 0) > 0
          AND b.is_storefront_visible = true
          AND (
            i.name ILIKE ANY(%s)
            OR COALESCE(i.description, '') ILIKE ANY(%s)
            OR sc.name ILIKE ANY(%s)
            OR c.name ILIKE ANY(%s)
          )
        GROUP BY i.id
        ORDER BY COUNT(bi.id) DESC, i.created_at DESC
        LIMIT %s
        """,
        (patterns, patterns, patterns, patterns, limit),
    )
    return [r[0] for r in cur.fetchall()]


def existing_collections() -> dict[str, dict[str, Any]]:
    data = gql(
        """
        query {
          collections {
            id slug name_en name_fr is_featured sort_order
            item_collections_aggregate { aggregate { count } }
          }
        }
        """
    )
    out: dict[str, dict[str, Any]] = {}
    for row in data["collections"]:
        out[row["slug"]] = row
    return out


def build_plan(cur) -> list[ProposedCollection]:
    cats = fetch_top_categories(cur, TOP_CATEGORIES)
    subs = fetch_top_subcategories(cur, TOP_SUBCATEGORIES)
    existing = existing_collections()
    used_slugs = set(existing.keys())
    proposals: list[ProposedCollection] = []

    # Category-based collections first (featured for top N new).
    featured_slots = FEATURED_NEW_COUNT
    sort_order = 100
    for cat in cats:
        slug = slugify(cat["name"])
        if slug in used_slugs:
            continue
        used_slugs.add(slug)
        is_featured = featured_slots > 0
        if is_featured:
            featured_slots -= 1
        item_ids = sample_item_ids_for_category(cur, cat["id"], ITEMS_PER_COLLECTION)
        if len(item_ids) < 4:
            continue
        name = cat["name"].strip()
        proposals.append(
            ProposedCollection(
                slug=slug,
                name_en=title_en_from_fr(name),
                name_fr=name,
                description_en=f"Shop {name} on Rendasua",
                description_fr=f"Découvrez {name} sur Rendasua",
                is_featured=is_featured,
                sort_order=sort_order if is_featured else sort_order + 500,
                source="category",
                source_id=int(cat["id"]),
                item_ids=item_ids,
            )
        )
        sort_order += 10

    # Subcategory collections (usually not featured unless slots remain).
    for sub in subs:
        slug = slugify(sub["name"])
        if slug in used_slugs:
            continue
        # Skip ultra-generic Autres etc. already filtered; skip if same as parent slug.
        if slugify(sub["category_name"]) == slug:
            continue
        used_slugs.add(slug)
        is_featured = featured_slots > 0
        if is_featured:
            featured_slots -= 1
        item_ids = sample_item_ids_for_subcategory(cur, sub["id"], ITEMS_PER_COLLECTION)
        if len(item_ids) < 4:
            continue
        name = sub["name"].strip()
        proposals.append(
            ProposedCollection(
                slug=slug,
                name_en=title_en_from_fr(name),
                name_fr=name,
                description_en=f"{name} — {sub['category_name']}",
                description_fr=f"{name} — {sub['category_name']}",
                is_featured=is_featured,
                sort_order=sort_order if is_featured else sort_order + 800,
                source="subcategory",
                source_id=int(sub["id"]),
                item_ids=item_ids,
            )
        )
        sort_order += 10

    # Refresh thin essentials (< 4 linked items).
    for slug, hints in ESSENTIAL_KEYWORD_HINTS.items():
        row = existing.get(slug)
        if not row:
            continue
        count = row["item_collections_aggregate"]["aggregate"]["count"]
        if count >= 4:
            continue
        need = max(4 - count, ITEMS_PER_COLLECTION - count)
        item_ids = sample_items_by_keywords(cur, hints, need + 4)
        if not item_ids:
            continue
        proposals.append(
            ProposedCollection(
                slug=slug,
                name_en=row["name_en"],
                name_fr=row["name_fr"],
                description_en="",
                description_fr="",
                is_featured=True,
                sort_order=row["sort_order"],
                source="essentials-refresh",
                source_id=None,
                item_ids=item_ids[:need],
            )
        )

    return proposals


def cmd_discover(cur) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    cats = fetch_top_categories(cur, TOP_CATEGORIES)
    subs = fetch_top_subcategories(cur, TOP_SUBCATEGORIES)
    existing = existing_collections()
    payload = {
        "env": os.environ.get("ENV_NAME"),
        "existing_collections": [
            {
                "slug": s,
                "is_featured": c["is_featured"],
                "item_count": c["item_collections_aggregate"]["aggregate"]["count"],
            }
            for s, c in existing.items()
        ],
        "top_categories": cats,
        "top_subcategories": subs,
    }
    out = REPORTS / "discover.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nWrote {out}", file=sys.stderr)


def cmd_plan(cur) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    proposals = build_plan(cur)
    out = REPORTS / "plan.json"
    data = [asdict(p) for p in proposals]
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Proposed {len(proposals)} collection actions:")
    for p in proposals:
        print(
            f"  [{p.source}] {p.slug} featured={p.is_featured} items={len(p.item_ids)} sort={p.sort_order}"
        )
    print(f"\nWrote {out}", file=sys.stderr)


def insert_collection(proposal: ProposedCollection) -> str:
    data = gql(
        """
        mutation InsertCollection($object: collections_insert_input!) {
          insert_collections_one(object: $object) { id slug }
        }
        """,
        {
            "object": {
                "slug": proposal.slug,
                "name_en": proposal.name_en,
                "name_fr": proposal.name_fr,
                "description_en": proposal.description_en or None,
                "description_fr": proposal.description_fr or None,
                "is_featured": proposal.is_featured,
                "sort_order": proposal.sort_order,
            }
        },
    )
    return data["insert_collections_one"]["id"]


def link_items(collection_id: str, item_ids: list[str]) -> int:
    if not item_ids:
        return 0
    objects = [{"collection_id": collection_id, "item_id": item_id} for item_id in item_ids]
    data = gql(
        """
        mutation InsertItemCollections($objects: [item_collections_insert_input!]!) {
          insert_item_collections(
            objects: $objects
            on_conflict: {
              constraint: item_collections_pkey
              update_columns: []
            }
          ) { affected_rows }
        }
        """,
        {"objects": objects},
    )
    return int(data["insert_item_collections"]["affected_rows"])


def cmd_apply(cur, dry_run: bool, confirm: str | None) -> None:
    proposals = build_plan(cur)
    existing = existing_collections()
    if dry_run:
        print(f"DRY RUN — would process {len(proposals)} proposals")
        for p in proposals:
            exists = p.slug in existing
            print(
                f"  {'refresh' if exists else 'create'} {p.slug} "
                f"featured={p.is_featured} items={len(p.item_ids)}"
            )
        return

    if os.environ.get("ENV_NAME") == "prod" and confirm != "YES":
        raise SystemExit("Refusing prod apply without --confirm YES")

    created = 0
    linked = 0
    for p in proposals:
        row = existing.get(p.slug)
        if row:
            collection_id = row["id"]
            print(f"Refresh existing {p.slug} ({collection_id})")
        else:
            collection_id = insert_collection(p)
            created += 1
            print(f"Created {p.slug} ({collection_id})")
        n = link_items(collection_id, p.item_ids)
        linked += n
        print(f"  linked {n} items")
    print(f"Done. created={created} link_rows={linked}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("discover")
    sub.add_parser("plan")

    apply_p = sub.add_parser("apply")
    apply_p.add_argument("--dry-run", action="store_true")
    apply_p.add_argument("--confirm", default=None)

    args = parser.parse_args()
    with connect() as conn:
        with conn.cursor() as cur:
            if args.cmd == "discover":
                cmd_discover(cur)
            elif args.cmd == "plan":
                cmd_plan(cur)
            elif args.cmd == "apply":
                cmd_apply(cur, dry_run=args.dry_run, confirm=args.confirm)


if __name__ == "__main__":
    main()
