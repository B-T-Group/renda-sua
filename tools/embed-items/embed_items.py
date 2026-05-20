#!/usr/bin/env python3
"""
Backfill public.items.name_embedding and description_embedding (OpenAI text-embedding-3-small, 1536d).

Prerequisites:
  - Migration 20260520120000_items_embedding_search applied.
  - DATABASE_URL (or --dsn) pointing at Postgres with pgvector.
  - OPENAI_API_KEY in the environment.

Usage:
  pip install -r requirements.txt
  export DATABASE_URL="postgres://postgres:postgrespassword@127.0.0.1:5432/postgres"
  export OPENAI_API_KEY="sk-..."
  python embed_items.py
  python embed_items.py --item-id <uuid> --dry-run
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Sequence

import psycopg2
from openai import OpenAI
from pgvector.psycopg2 import register_vector

EMBEDDING_DIM = 1536
MODEL = "text-embedding-3-small"

logger = logging.getLogger(__name__)


def connect(dsn: str):
    conn = psycopg2.connect(dsn)
    register_vector(conn)
    return conn


def fetch_rows(cur, item_id: str | None) -> list[tuple]:
    if item_id:
        cur.execute(
            """
            SELECT id, name, description
            FROM public.items
            WHERE id = %s::uuid AND status IS DISTINCT FROM 'deleted'
            """,
            (item_id,),
        )
    else:
        cur.execute(
            """
            SELECT id, name, description
            FROM public.items
            WHERE status IS DISTINCT FROM 'deleted'
            ORDER BY created_at
            """
        )
    return cur.fetchall()


def embed_batch(client: OpenAI, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    resp = client.embeddings.create(model=MODEL, input=texts)
    ordered = sorted(resp.data, key=lambda d: d.index)
    return [d.embedding for d in ordered]


def vector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(v) for v in values) + "]"


def backfill(
    conn,
    client: OpenAI,
    batch_size: int,
    dry_run: bool,
    item_id: str | None,
) -> int:
    updated = 0
    with conn.cursor() as cur:
        rows = fetch_rows(cur, item_id)
        if not rows:
            logger.info("No items to embed.")
            return 0

        for i in range(0, len(rows), batch_size):
            chunk = rows[i : i + batch_size]
            name_texts = [(r[1] or "").strip() for r in chunk]
            desc_texts = [(r[2] or "").strip() for r in chunk]
            name_vectors = embed_batch(client, name_texts)

            desc_inputs: list[str] = []
            desc_indices: list[int] = []
            for j, t in enumerate(desc_texts):
                if t:
                    desc_inputs.append(t)
                    desc_indices.append(j)
            desc_vectors: list[list[float] | None] = [None] * len(chunk)
            if desc_inputs:
                embedded = embed_batch(client, desc_inputs)
                for idx, vec in zip(desc_indices, embedded):
                    desc_vectors[idx] = vec

            for (row_id, _name, _desc), name_vec, desc_vec in zip(
                chunk, name_vectors, desc_vectors
            ):
                if len(name_vec) != EMBEDDING_DIM:
                    raise RuntimeError(
                        f"Expected {EMBEDDING_DIM} dims, got {len(name_vec)}"
                    )
                if dry_run:
                    logger.info("dry-run item_id=%s", row_id)
                    updated += 1
                    continue
                if desc_vec is not None:
                    cur.execute(
                        """
                        UPDATE public.items
                        SET name_embedding = %s::vector,
                            description_embedding = %s::vector
                        WHERE id = %s::uuid
                        """,
                        (vector_literal(name_vec), vector_literal(desc_vec), row_id),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE public.items
                        SET name_embedding = %s::vector,
                            description_embedding = NULL
                        WHERE id = %s::uuid
                        """,
                        (vector_literal(name_vec), row_id),
                    )
                updated += 1
            if not dry_run:
                conn.commit()
            logger.info("Processed %s / %s items", min(i + batch_size, len(rows)), len(rows))
    return updated


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Backfill item embeddings for semantic search.")
    p.add_argument(
        "--dsn",
        default=os.environ.get("DATABASE_URL") or os.environ.get("PG_DATABASE_URL"),
        help="Postgres DSN",
    )
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--item-id", help="Backfill a single item UUID")
    return p.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args(argv)
    if not args.dsn:
        logger.error("Set DATABASE_URL or pass --dsn")
        return 1
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        logger.error("Set OPENAI_API_KEY")
        return 1

    client = OpenAI(api_key=api_key)
    conn = connect(args.dsn)
    try:
        n = backfill(conn, client, args.batch_size, args.dry_run, args.item_id)
        logger.info("Done. items_processed=%s", n)
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
