#!/usr/bin/env python3
"""
Backfill public.google_product_categories.embedding and public.fb_product_categories.embedding
using a local multilingual sentence-transformers model (384-d, L2-normalized).

Prerequisites:
  - Migration 20260424120300 (pgvector + embedding columns) applied.
  - Postgres with CREATE EXTENSION vector; connection string in DATABASE_URL (or --dsn).
  - For apps/hasura/docker-compose: start the stack so Postgres is up; use e.g.
    export DATABASE_URL="postgres://postgres:postgrespassword@127.0.0.1:5432/postgres"
  - If you see "RuntimeError: Numpy is not available": pip install "numpy>=1.24,<2" in the same venv, then retry.

Usage:
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  export DATABASE_URL="postgres://user:pass@host:5432/dbname"
  python embed_product_taxonomy.py
  # optional: python embed_product_taxonomy.py --table google
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Sequence

import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

EMBEDDING_DIM = 384
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"


def build_label_text(name_en: str, name_fr: str | None) -> str:
    en = (name_en or "").strip()
    fr = (name_fr or "").strip()
    if fr:
        return f"{en} | {fr}"
    return en


def connect(dsn: str):
    conn = psycopg2.connect(dsn)
    register_vector(conn)
    return conn


def fetch_table_rows(cur, table: str) -> list[tuple]:
    q = f"SELECT id, name_en, name_fr FROM public.{table} ORDER BY id"
    cur.execute(q)
    return cur.fetchall()


def backfill_table(
    cur,
    model: SentenceTransformer,
    table: str,
    batch_size: int,
) -> int:
    rows = fetch_table_rows(cur, table)
    if not rows:
        return 0
    texts = [build_label_text(r[1], r[2]) for r in rows]
    ids = [r[0] for r in rows]
    embs = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
    )
    n = 0
    for row_id, emb in zip(ids, embs):
        vec = np.asarray(emb, dtype=np.float32)
        if vec.shape[0] != EMBEDDING_DIM:
            raise SystemExit(
                f"Expected dim {EMBEDDING_DIM}, got {vec.shape[0]}. Check MODEL_NAME."
            )
        cur.execute(
            f"UPDATE public.{table} SET embedding = %s WHERE id = %s",
            (vec, row_id),
        )
        n += 1
    return n


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Backfill product taxonomy embedding columns (pgvector, 384-d)."
    )
    p.add_argument(
        "--dsn",
        default=os.environ.get("DATABASE_URL") or os.environ.get("PG_DATABASE_URL"),
        help="Postgres DSN (default: DATABASE_URL or PG_DATABASE_URL env)",
    )
    p.add_argument(
        "--table",
        choices=("google", "fb", "all"),
        default="all",
        help="Which table to backfill (default: all).",
    )
    p.add_argument("--batch-size", type=int, default=128, help="Encode batch size.")
    p.add_argument(
        "--model",
        default=MODEL_NAME,
        help=f"Sentence-Transformers model (default: {MODEL_NAME!r}).",
    )
    return p.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    dsn = args.dsn
    if not dsn:
        print(
            "Error: set DATABASE_URL or pass --dsn",
            file=sys.stderr,
        )
        return 1
    model = SentenceTransformer(args.model)
    dim = model.get_sentence_embedding_dimension()
    if dim != EMBEDDING_DIM:
        print(
            f"Error: model outputs {dim} dims, migration uses vector({EMBEDDING_DIM}).",
            file=sys.stderr,
        )
        return 1
    run_google = args.table in ("google", "all")
    run_fb = args.table in ("fb", "all")
    conn = connect(dsn)
    try:
        with conn:
            with conn.cursor() as cur:
                if run_google:
                    n = backfill_table(
                        cur, model, "google_product_categories", args.batch_size
                    )
                    print(f"google_product_categories: updated {n} rows")
                if run_fb:
                    n = backfill_table(
                        cur, model, "fb_product_categories", args.batch_size
                    )
                    print(f"fb_product_categories: updated {n} rows")
    finally:
        conn.close()
    print(
        "Optional: create ANN indexes (run in psql after backfill, if supported):\n"
        "CREATE INDEX IF NOT EXISTS idx_google_product_categories_embedding_hnsw "
        "ON public.google_product_categories USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64);\n"
        "CREATE INDEX IF NOT EXISTS idx_fb_product_categories_embedding_hnsw "
        "ON public.fb_product_categories USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64);"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
