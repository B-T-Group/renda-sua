# embed-product-taxonomy

Python tool that:

1. **Embeds** rows in `google_product_categories` and `fb_product_categories` (384-d vectors, `pgvector`), using `name_en` and optional `name_fr`.
2. **Optionally maps** each `item_sub_categories` row to Google and Facebook taxonomy IDs by cosine similarity between:
   - an internal label: `{item_categories.name} > {item_sub_categories.name}`, and  
   - the precomputed taxonomy embeddings.

Default model: `paraphrase-multilingual-MiniLM-L12-v2` (must match `vector(384)` in the DB migration).

## Prerequisites

- Python 3.10+ recommended.
- Hasura migrations applied, including:
  - product taxonomy tables and seeds,
  - `20260424120300_add_product_taxonomy_embeddings` (`pgvector`, `embedding` columns).
- PostgreSQL with the **`vector`** extension (e.g. `pgvector/pgvector` image in `apps/hasura/docker-compose.yaml`).
- Postgres reachable from your machine. For local Docker Compose, `postgres` should publish **5432** (see compose file); use the URL below.

## Setup

```bash
cd tools/embed-product-taxonomy
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Set the database URL (same user/password as your local Postgres):

```bash
export DATABASE_URL="postgres://postgres:postgrespassword@127.0.0.1:5432/postgres"
```

Or pass `--dsn` on the command line.

## Usage

### 1. Taxonomy embeddings only (default)

Fills `embedding` on both taxonomy tables from `name_en` / `name_fr`.

```bash
python embed_product_taxonomy.py
```

Embed only one table:

```bash
python embed_product_taxonomy.py --table google   # or fb
```

### 2. Taxonomy embeddings + map `item_sub_categories`

Runs (1), then for each subcategory updates `google_product_category` and `fb_product_category` when the best cosine similarity is **≥ `--min-similarity`** (default `0.45`).

```bash
python embed_product_taxonomy.py --map-subcategories
```

### 3. Map subcategories only

Use when taxonomy rows **already** have embeddings (e.g. you ran step 1 earlier).

```bash
python embed_product_taxonomy.py --no-embed-taxonomy --map-subcategories
```

**Note:** `--no-embed-taxonomy` without `--map-subcategories` is invalid (nothing to do).

## Flags

| Flag | Description |
|------|-------------|
| `--dsn` | Postgres connection string (overrides env). |
| `--table` | `google` \| `fb` \| `all` — which taxonomy table to embed (default: `all`). |
| `--no-embed-taxonomy` | Skip writing taxonomy `embedding` columns. |
| `--map-subcategories` | Match and update `item_sub_categories` Google/FB FKs. |
| `--min-similarity` | Minimum cosine similarity to accept a match (0–1, default `0.45`). |
| `--batch-size` | Sentence-Transformer encode batch size (default `128`). |
| `--model` | HuggingFace / Sentence-Transformers model name (default matches 384-d migration). |
| `-v` / `--verbose` | More logging (DEBUG). |

Logs: on success you see `INFO` lines for rows where at least one side matched; `WARNING` when both sides are below the threshold (best scores still logged).

## Optional: ANN indexes (after embeddings exist)

For large-scale nearest-neighbor search in SQL, you can add HNSW indexes. The script prints example `CREATE INDEX` statements after a taxonomy-only run, or use:

```sql
CREATE INDEX IF NOT EXISTS idx_google_product_categories_embedding_hnsw
  ON public.google_product_categories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_fb_product_categories_embedding_hnsw
  ON public.fb_product_categories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `Connection refused` on port 5432 | Start Docker Compose; ensure Postgres publishes `127.0.0.1:5432:5432`. |
| `Numpy is not available` | `pip install "numpy>=1.24,<2"` in the same venv, then retry. |
| `No matching distribution for torch` / PyTorch too new | `requirements.txt` pins compatible versions; use a supported Python (e.g. 3.10–3.12). |
| `extension "vector" does not exist` | Use a Postgres image with **pgvector**, or install the extension on your server. |
| Poor subcategory matches | Lower or raise `--min-similarity`, or fix category/subcategory names so `{category} > {subcategory}` aligns with English taxonomy phrasing. |

## Hasura

GraphQL is configured **not** to select `embedding` on taxonomy tables (keeps API payloads small). Embeddings are for offline jobs and raw SQL as needed.
