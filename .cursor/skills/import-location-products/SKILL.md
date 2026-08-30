---
name: import-location-products
description: >-
  Imports sale products into a business location from a CSV (plus optional
  image URLs/files), uses AI to enrich titles/descriptions/categories, shows a
  preview, then inserts items / item_images / business_inventory via Postgres
  using AWS Secrets Manager DATABASE_URL for development or prod. Use when the
  user asks to import products for a location, CSV catalog import, bulk seed
  inventory for a business_location_id, or AI-generate product details from a
  spreadsheet.
---

# Import location products (CSV + AI → preview → DB)

Create **ready catalog + inventory** rows for one `business_location_id` from a CSV. Enrich incomplete rows with AI (text + image when available). **Always preview and wait for explicit OK** before writing.

## Required inputs

1. **Environment**: `dev` | `prod` (ask if missing; confirm **prod** before writes).
2. **`business_location_id`** (UUID).
3. **CSV path** (or pasted table). See column map in [reference.md](reference.md).
4. Optional: local image folder or per-row `image_url` / `image_path`.

Never print or commit `DATABASE_URL`, passwords, or secret JSON. Log only DB **hostname** and env name.

## Secrets Manager → DATABASE_URL

| Env | Secret id | Region default |
|-----|-----------|----------------|
| `prod` | `production-rendasua-backend-secrets` | `ca-central-1` |
| `dev` | `development-rendasua-backend-secrets` | `ca-central-1` |

```bash
REGION="${AWS_REGION:-ca-central-1}"
SECRET_ID="development-rendasua-backend-secrets"   # or production-…
export DATABASE_URL="$(
  aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ID" \
    --region "$REGION" \
    --query SecretString \
    --output text \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_URL"])'
)"
# Log only: hostname from urlparse — never echo DATABASE_URL
```

Same pattern as [map-product-taxonomy](../map-product-taxonomy/SKILL.md) / `tools/embed-product-taxonomy/run-map.sh`.

## Workflow checklist

```
Import location products:
- [ ] Confirm env (dev|prod) + business_location_id + CSV
- [ ] Load DATABASE_URL from Secrets Manager (hostname only in logs)
- [ ] Validate location → business_id, currency, rail hints
- [ ] Load existing categories / subcategories / brands for that business context
- [ ] Parse CSV; normalize columns (aliases in reference.md)
- [ ] AI-enrich each row (name, description, category/subcategory, brand, attributes)
- [ ] Build preview plan JSON; show summary to user
- [ ] User says OK
- [ ] Insert in FK order (categories → brands → items → images → inventory)
- [ ] Report item ids / inventory ids / failures
```

### 1) Validate location

Against Postgres (`DATABASE_URL`):

```sql
SELECT bl.id, bl.name, bl.business_id, b.currency
FROM public.business_locations bl
JOIN public.businesses b ON b.id = bl.business_id
WHERE bl.id = $<business_location_id>;
```

Stop if missing. Lock **`items.currency`** to `b.currency` (never trust CSV currency).

Also load:

- Active `item_categories` + `item_sub_categories` (id, names)
- Existing item names/skus for this `business_id` (idempotency)
- Existing inventory for this location (avoid duplicate location+item rows)

### 2) Parse CSV

Required effective fields after enrichment (may be filled by AI):

| Field | Notes |
|-------|--------|
| `name` | Required |
| `price` / `selling_price` | > 0 for ready product |
| `quantity` | Default **10** if blank |
| `image_url` or usable `image_path` | Strongly preferred; generate image only if user allows |

Optional: description, sku, brand, category, subcategory, unit_cost, reorder_*, weight, color, model, dimensions, is_used, etc. Full alias map: [reference.md](reference.md). Example: [scripts/products.example.csv](scripts/products.example.csv).

### 3) AI enrichment (per row)

Using CSV text **and** the product image when available (vision):

1. Clean / complete **name** (retail-ready, no spam).
2. Write **description** (2–4 sentences, factual; no invented certifications).
3. Propose **categoryName** + **subCategoryName** — prefer matching existing taxonomy (case-insensitive); otherwise propose **new** active category/subcategory (or fallback `Other` / `Other`).
4. Propose **brandName** when obvious; else omit.
5. Infer optional attributes (color, model, weight) only when confident from CSV/image.
6. Set **unit_cost** default to `0` or ~60% of selling price if blank (document choice in preview).
7. Do **not** invent SKUs that collide; generate `IMP-<shortuuid>` if blank.

Write a plan file (temp or `scripts/plans/<locationId>-<timestamp>.json`) with one object per row: source fields, AI fields, resolved subcategory strategy (`existing_id` | `create` | `Other`), image disposition, inventory numbers.

### 4) Preview (mandatory gate)

Show the user a compact table:

- Row #, name, price, qty, category → subcategory, brand, image (url / local / none), create vs skip-duplicate

Then ask: **Proceed with insert?** Do not write until they confirm. Allow edits to the plan JSON if they request changes.

### 5) Insert (after OK)

Prefer a **single transaction per batch** (or per row with clear error isolation). FK order:

1. `item_categories` / `item_sub_categories` (find-or-create `status='active'`, description `''`)
2. `brands` (find-or-create by unique name; `approved=true`, description = name)
3. `items` — see gap checklist below
4. `item_images` — `business_id`, `item_id`, `image_url` NOT NULL; `image_type='main'` for first; `status='assigned'`; `tags='{}'`; `is_ai_cleaned=false`
5. `business_inventory` — unique (location, item) with `item_variant_id` null

**Idempotency**: if same business already has item with same name or sku, **skip create** and optionally upsert inventory at this location only (state that in preview). Do not silently duplicate items.

**Images**:

- Remote `image_url` → store URL as-is (same as Nest CSV upload).
- Local file → upload via Nest `POST /aws/presigned-url/image` + PUT + public URL **if** a business JWT is available; otherwise ask user for a public URL. Do not invent S3 URLs.
- No image → create item without `item_images` only if user accepts; note that Nest activation requires ≥1 image for live catalog.

### 6) Done report

For each row: item id, inventory id, subcategory id, image linked?, skipped/error reason. Remind that direct SQL leaves items in **`moderation_status='draft'`**, **`is_active=false`** until publish/approve (or admin approve). Embeddings / AI moderation may be missing until Nest publish path runs.

## Gap checklist (always fill)

When inserting `items`, set:

| Column | Value |
|--------|--------|
| `business_id` | From location |
| `currency` | Business currency |
| `description` | `''` if still empty after AI |
| `item_sub_category_id` | Resolved NOT NULL id |
| `price` | Catalog price (> 0) |
| `sku` | Provided or generated unique per business |
| `status` | `'active'` |
| `moderation_status` | `'draft'` |
| `is_active` | `false` |
| `ai_review_version` | `0` |
| `is_used` | from CSV or `false` |
| `min_order_quantity` | `1` |
| `max_order_quantity` | `10` |
| `pay_on_delivery_enabled` | `true` for mobile-money CFA markets (CM/GA/TG/BJ/CI/CG); else `false` unless known Stripe rail |
| `shipping_enabled` | `false` |
| `stripe_tax_code_id` | `'txcd_99999999'` (general tangible) |

When inserting `business_inventory`:

| Column | Default if CSV blank |
|--------|----------------------|
| `quantity` | `10` |
| `reserved_quantity` | `0` |
| `reorder_point` | `0` |
| `reorder_quantity` | `0` |
| `unit_cost` | `0` |
| `selling_price` | item `price` |
| `is_active` | `true` |
| `item_variant_id` | `NULL` (no variants in this skill unless CSV explicitly requests them) |

## Prefer Nest when JWT is available

If the user can supply a **business Bearer token**, prefer the app path (side effects preserved):

1. Presign + bulk images → `POST /business-items/create-from-image` (or `POST /business-items/csv-upload`)
2. `POST /business-items/inventory` with `business_location_id`
3. Optional publish + admin approve

Use Secrets Manager + SQL when they asked for DB import, JWT is unavailable, or env has no convenient API auth. Details: [reference.md](reference.md).

## Guardrails

- Confirm **prod** before any write.
- Never commit secrets, plan files with credentials, or downloaded PII beyond the CSV the user provided.
- Do not create users or businesses; location must already exist.
- Do not force-approve items unless the user explicitly asks for admin approval.
- Skip Nest migrations / Hasura seed SQL for tenant catalog data.
