---
name: map-product-taxonomy
description: >-
  Maps item_sub_categories to Google and Facebook product taxonomy IDs via
  embedding similarity (tools/embed-product-taxonomy) against prod or dev
  Postgres using AWS Secrets Manager DATABASE_URL. Use when the user asks to
  map product taxonomy, fill fb_product_category / google_product_category,
  run embed-product-taxonomy, or fix missing Facebook catalog categories in
  prod/dev.
---

# Map product taxonomy (prod | dev)

Fill `item_sub_categories.google_product_category` and `fb_product_category` by cosine similarity against pre-seeded `google_product_categories` / `fb_product_categories` embeddings.

## Resolve environment

| User says | Env | Secrets Manager secret |
|-----------|-----|------------------------|
| prod / production | `prod` | `production-rendasua-backend-secrets` |
| dev / development | `dev` | `development-rendasua-backend-secrets` |

If ambiguous, ask once. Default region: `ca-central-1`.

## Defaults

- `--min-similarity`: **0.45** for a first pass; use **0.35** only when the user wants broader coverage for remaining nulls (weaker matches).
- Prefer **`--no-embed-taxonomy`** when taxonomy `embedding` columns are already populated (typical for prod/dev after the first backfill). Use `--embed-taxonomy` only if embeddings are missing or the user asks to refresh them.
- Never print or commit `DATABASE_URL` / passwords. Log only the DB hostname.

## Run (preferred)

From the rendasua repo:

```bash
cd /Users/besongsamuel/Documents/Github/rs/rendasua/tools/embed-product-taxonomy
chmod +x run-map.sh   # once if needed
./run-map.sh prod --min-similarity 0.45
# or
./run-map.sh dev --min-similarity 0.45
```

Broader second pass:

```bash
./run-map.sh prod --min-similarity 0.35
```

Refresh taxonomy embeddings then map:

```bash
./run-map.sh prod --embed-taxonomy --min-similarity 0.45
```

Requirements: AWS CLI credentials that can `secretsmanager:GetSecretValue`, network to RDS, Python **3.10+** (3.11 preferred). The script creates `.venv` and installs `requirements.txt` if needed.

## Manual fallback (if run-map.sh missing)

1. Ensure venv + deps under `tools/embed-product-taxonomy`.
2. Export `DATABASE_URL` from the env’s secret JSON key `DATABASE_URL` (do not echo it).
3. Run:

```bash
python embed_product_taxonomy.py --no-embed-taxonomy --map-subcategories --min-similarity 0.45
```

If `TypeError` on pgvector `Vector`, ensure `embedding_to_float32` uses `Vector.to_list()` (see script).

## Verify

After the job, report coverage:

```sql
SELECT count(*) AS total,
       count(fb_product_category) AS with_fb,
       count(google_product_category) AS with_google
FROM public.item_sub_categories;
```

`run-map.sh` prints this as `coverage total=… with_fb=…`.

## Safety

- Confirm **prod** before writing if the user did not explicitly say prod.
- This updates subcategory FKs only (not individual `items` rows). Catalog feeds pick up categories via subcategory joins.
- Do not commit `.env*` or secrets. Local `.venv` stays untracked.
