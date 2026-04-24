#!/usr/bin/env python3
"""
Backfill public.google_product_categories.embedding and public.fb_product_categories.embedding
using a local multilingual sentence-transformers model (384-d, L2-normalized). Optionally
map item_sub_categories to Google/FB taxonomy ids by embedding similarity.

Prerequisites:
  - Migration 20260424120300 (pgvector + embedding columns) applied.
  - Postgres with CREATE EXTENSION vector; connection string in DATABASE_URL (or --dsn).
  - For apps/hasura/docker-compose: start the stack so Postgres is up; use e.g.
    export DATABASE_URL="postgres://postgres:postgrespassword@127.0.0.1:5432/postgres"
  - If you see "RuntimeError: Numpy is not available": pip install "numpy>=1.24,<2" in the same venv, then retry.

Usage:
  pip install -r requirements.txt
  export DATABASE_URL="postgres://postgres:postgrespassword@127.0.0.1:5432/postgres"
  # Taxonomy table embeddings only (default)
  python embed_product_taxonomy.py
  # Taxonomy + map item_sub_categories (requires labels like "Category > Subcategory")
  python embed_product_taxonomy.py --map-subcategories
  # Map only (taxonomy rows already have embeddings)
  python embed_product_taxonomy.py --no-embed-taxonomy --map-subcategories
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Sequence

import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

EMBEDDING_DIM = 384
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

logger = logging.getLogger(__name__)


def build_label_text(name_en: str, name_fr: str | None) -> str:
    en = (name_en or "").strip()
    fr = (name_fr or "").strip()
    if fr:
        return f"{en} | {fr}"
    return en


def build_subcategory_path(category_name: str, sub_name: str) -> str:
    c = (category_name or "").strip()
    s = (sub_name or "").strip()
    if c and s:
        return f"{c} > {s}"
    return c or s


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


def load_taxonomy_matrix(cur, table: str) -> tuple[np.ndarray, np.ndarray]:
    cur.execute(
        f"""
        SELECT id, embedding
        FROM public.{table}
        WHERE embedding IS NOT NULL
        ORDER BY id
        """
    )
    rows = cur.fetchall()
    if not rows:
        return (
            np.array([], dtype=np.int64),
            np.empty((0, EMBEDDING_DIM), dtype=np.float32),
        )
    ids = np.array([r[0] for r in rows], dtype=np.int64)
    mat = np.stack([np.asarray(r[1], dtype=np.float32) for r in rows])
    return ids, mat


def fetch_subcategories_with_categories(cur) -> list[tuple]:
    cur.execute(
        """
        SELECT isc.id, ic.name, isc.name
        FROM public.item_sub_categories isc
        JOIN public.item_categories ic ON ic.id = isc.item_category_id
        ORDER BY isc.id
        """
    )
    return cur.fetchall()


def best_matches(
    sub_embs: np.ndarray, tax_ids: np.ndarray, tax_mat: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if tax_mat.size == 0:
        empty = np.array([], dtype=np.int64)
        return empty, np.array([], dtype=np.float32), empty
    sims = sub_embs @ tax_mat.T
    best_i = np.argmax(sims, axis=1)
    best_s = sims[np.arange(sims.shape[0], dtype=np.intp), best_i]
    return best_i, best_s, tax_ids[best_i]


def map_item_subcategories(
    cur,
    model: SentenceTransformer,
    batch_size: int,
    min_sim: float,
) -> int:
    g_ids, g_mat = load_taxonomy_matrix(cur, "google_product_categories")
    f_ids, f_mat = load_taxonomy_matrix(cur, "fb_product_categories")
    if g_mat.size == 0 and f_mat.size == 0:
        print(
            "Error: no taxonomy embeddings found. Run without --no-embed-taxonomy first.",
            file=sys.stderr,
        )
        return 0
    sub_rows = fetch_subcategories_with_categories(cur)
    if not sub_rows:
        logger.info("item_sub_categories: no rows to map")
        return 0
    paths = [build_subcategory_path(r[1], r[2]) for r in sub_rows]
    s_ids = [r[0] for r in sub_rows]
    sub_embs = model.encode(
        paths,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
    )
    sub_embs = np.asarray(sub_embs, dtype=np.float32)
    return apply_subcategory_updates(
        cur, s_ids, paths, sub_embs, g_ids, g_mat, f_ids, f_mat, min_sim
    )


def apply_subcategory_updates(
    cur,
    s_ids: list,
    paths: list[str],
    sub_embs: np.ndarray,
    g_ids: np.ndarray,
    g_mat: np.ndarray,
    f_ids: np.ndarray,
    f_mat: np.ndarray,
    min_sim: float,
) -> int:
    if g_mat.size:
        _, g_s, g_pick = best_matches(sub_embs, g_ids, g_mat)
    else:
        g_s, g_pick = (
            np.array([], dtype=np.float32),
            np.array([], dtype=np.int64),
        )
    if f_mat.size:
        _, f_s, f_pick = best_matches(sub_embs, f_ids, f_mat)
    else:
        f_s, f_pick = (
            np.array([], dtype=np.float32),
            np.array([], dtype=np.int64),
        )
    n = 0
    for i, sc_id in enumerate(s_ids):
        g_best = int(g_pick[i]) if g_s.size else None
        fs_v = float(g_s[i]) if g_s.size else None
        f_best = int(f_pick[i]) if f_s.size else None
        ff_v = float(f_s[i]) if f_s.size else None
        g_set = g_best if fs_v is not None and fs_v >= min_sim else None
        f_set = f_best if ff_v is not None and ff_v >= min_sim else None
        log_subcategory_map(
            sc_id, paths[i], g_best, fs_v, f_best, ff_v, g_set, f_set, min_sim
        )
        cur.execute(
            """
            UPDATE public.item_sub_categories
            SET google_product_category = %s, fb_product_category = %s
            WHERE id = %s
            """,
            (g_set, f_set, sc_id),
        )
        n += 1
    return n


def log_subcategory_map(
    sc_id: int,
    path: str,
    g_best: int | None,
    g_cos: float | None,
    f_best: int | None,
    f_cos: float | None,
    g_set: int | None,
    f_set: int | None,
    min_sim: float,
) -> None:
    g_part = f"google best={g_best} cos={g_cos:.4f} set={g_set is not None}" if g_cos is not None else "google=—"
    f_part = f"fb best={f_best} cos={f_cos:.4f} set={f_set is not None}" if f_cos is not None else "fb=—"
    line = f'subcategory_id={sc_id} label="{path}" {g_part} {f_part} (min={min_sim})'
    if g_set is not None or f_set is not None:
        logger.info("subcategory_map %s", line)
    else:
        logger.warning("subcategory_map_below_threshold %s", line)


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Backfill taxonomy embeddings and/or map item_sub_categories (pgvector, 384-d)."
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
        help="Which taxonomy table to embed (default: all).",
    )
    p.add_argument(
        "--no-embed-taxonomy",
        action="store_true",
        help="Skip updating google/fb taxonomy embedding columns.",
    )
    p.add_argument(
        "--map-subcategories",
        action="store_true",
        help="Set item_sub_categories.google_product_category and fb_product_category from embedding similarity.",
    )
    p.add_argument(
        "--min-similarity",
        type=float,
        default=0.45,
        help="Min cosine similarity (0-1) to accept a match (default: 0.45).",
    )
    p.add_argument("--batch-size", type=int, default=128, help="Encode batch size.")
    p.add_argument(
        "--model",
        default=MODEL_NAME,
        help=f"Sentence-Transformers model (default: {MODEL_NAME!r}).",
    )
    p.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Log every subcategory; default is INFO for real matches, WARNING for none.",
    )
    return p.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    dsn = args.dsn
    if not dsn:
        print("Error: set DATABASE_URL or pass --dsn", file=sys.stderr)
        return 1
    if args.no_embed_taxonomy and not args.map_subcategories:
        print(
            "Error: nothing to do. Omit --no-embed-taxonomy and/or add --map-subcategories",
            file=sys.stderr,
        )
        return 1
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=log_level, format="%(levelname)s %(message)s")
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
    do_embed = not args.no_embed_taxonomy
    conn = connect(dsn)
    try:
        with conn:
            with conn.cursor() as cur:
                if do_embed:
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
                if args.map_subcategories:
                    n = map_item_subcategories(
                        cur, model, args.batch_size, args.min_similarity
                    )
                    print(f"item_sub_categories: updated {n} rows")
    finally:
        conn.close()
    if do_embed and not args.map_subcategories:
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
