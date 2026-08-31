---
name: import-location-rentals
description: >-
  Imports rental catalog items into a business location from a CSV (plus optional
  image URLs/files), uses AI to enrich titles/descriptions/categories, then
  inserts rental_items / rental_item_images / rental_location_listings /
  rental_listing_weekly_availability immediately via Postgres using AWS Secrets
  Manager DATABASE_URL for development or prod. Use when the user asks to import
  rentals for a location, CSV rental catalog import, bulk seed rental listings
  for a business_location_id, or AI-generate rental details from a spreadsheet.
---

# Import location rentals (CSV + AI → DB)

Create **rental catalog + location listings** for one `business_location_id` from a CSV. Enrich incomplete rows with AI (text + image when available). **Insert immediately** for unambiguous rows — no preview / confirmation gate.

Rentals are a **separate domain** from sale products (`items` / `business_inventory`). Do **not** use [import-location-products](../import-location-products/SKILL.md) for this.

## No ambiguity — do not import

**Do not insert any row if anything is ambiguous.** Prefer skipping / blocking over guessing.

Treat as ambiguous (examples, not exhaustive):

- Env, location, or business ownership unclear or conflicting
- Price unclear (hourly vs day, currency, “from / quote / sur demande”, range, unit mismatch)
- Category could map to multiple existing `rental_categories`, or creating a new category is speculative
- Near-duplicate name / possible reuse of an existing `rental_item` vs create — not a clear match
- **Image missing** (no usable `image_url` / `image_urls` / `image_path`) — **never insert** that row
- Multiple candidate images with no clear primary set
- `operation_mode` not clear (`business_operated` vs `take_home`)
- Deposit / units / hours / weekly availability cannot be derived without assuming

**Behavior:**

1. Mark the row `action: blocked_ambiguous` in the plan with a short reason.
2. **Insert unambiguous rows right away**; never write blocked rows.
3. In the done report, list every blocked row and its reason so the user can clarify and re-run.
4. Never invent prices, categories, or identity matches to “make the import work.”
5. Still confirm **prod** before any write when env is production.

## Required inputs

1. **Environment**: `dev` | `prod` (ask if missing; confirm **prod** before writes).
2. **`business_location_id`** (UUID).
3. **CSV path** (or pasted table). See column map in [reference.md](reference.md).
4. Optional: local image folder or per-row `image_url` / `image_urls` / `image_path`.

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

Same pattern as [import-location-products](../import-location-products/SKILL.md) / [map-product-taxonomy](../map-product-taxonomy/SKILL.md).

## Workflow checklist

```
Import location rentals:
- [ ] Confirm env (dev|prod) + business_location_id + CSV
- [ ] Load DATABASE_URL from Secrets Manager (hostname only in logs)
- [ ] Validate location → business_id, currency (via country), rails
- [ ] Load active rental_categories + existing rental_items for business
- [ ] Load existing listings at this location (idempotency)
- [ ] Parse CSV; normalize columns (aliases in reference.md)
- [ ] AI-enrich each row (name, description, category, tags, prices)
- [ ] Build plan JSON; mark blocked_ambiguous rows
- [ ] Insert unambiguous rows immediately (categories → items → images → listings → weekly_availability)
- [ ] Report rental_item ids / listing ids / blocked / failures
```

### 1) Validate location

`businesses` may **not** have a `currency` column. Resolve currency from primary address country (same as Nest `resolveBusinessCurrency`):

```sql
SELECT bl.id, bl.name, bl.business_id, b.name AS business_name,
       a.country,
       scs.currency
FROM public.business_locations bl
JOIN public.businesses b ON b.id = bl.business_id
LEFT JOIN public.addresses a ON a.id = b.address_id   -- adjust join if address path differs
LEFT JOIN public.supported_country_states scs
  ON scs.country_code = a.country
WHERE bl.id = $<business_location_id>
LIMIT 1;
```

If currency still unknown, inspect how addresses link on this env (business → user → address, or location address) and fall back to `XAF` only when country is CFA; for `CA` use `CAD`. Stop if location missing.

Also load:

- Active `rental_categories` (id, name, slug)
- Existing `rental_items` for this `business_id` where `deleted_at IS NULL` (name match)
- Existing `rental_location_listings` for this location where `deleted_at IS NULL`

### 2) Parse CSV

Required effective fields after enrichment (may be filled by AI):

| Field | Notes |
|-------|--------|
| `name` | Required |
| `base_price_per_hour` | > 0 |
| `base_price_per_day` | > 0 (all-day flat rate); if blank, AI/default = `hourly × 8` (document in plan notes) |
| `units_available` | Default **1** |
| `image_url` / `image_urls` | **Required** — at least **1** usable HTTPS URL (or uploaded local path). Prefer ≥2 (Nest activation). **No image → `blocked_ambiguous`, do not insert** |

Optional: description, rental_category, operation_mode, security_deposit, min/max hours, pickup/dropoff, tags, weekly hours. Full map: [reference.md](reference.md). Example: [scripts/rentals.example.csv](scripts/rentals.example.csv).

### 3) AI enrichment (per row)

Using CSV text **and** images when available (vision):

1. Clean / complete **name** (rental-ready, no spam).
2. Write **description** (2–4 sentences, factual; no invented certifications or insurance claims).
3. Propose **rentalCategoryName** — prefer matching existing `rental_categories` (case-insensitive); else propose **new** active category (slugify) or fallback **Other**.
4. Infer `operation_mode`: `business_operated` (default) vs `take_home` only when CSV/context is clear.
5. Infer tags (short keywords) when useful; else `{}`.
6. If only one price given, treat as hourly and set day = `hourly × 8` (or reverse if clearly a day rate — document choice).
7. Deposit blank → `hourly × 8` (Nest default).
8. Do **not** invent SKUs (rentals have none).

Write plan: `scripts/plans/<locationId>-rentals-<timestamp>.json` with one object per row. Then **insert immediately** (next step) — do not wait for user confirmation.

### 4) Insert (immediate)

Single transaction per batch (or per-row isolation). Skip `blocked_ambiguous` / `skip_*` rows. FK order:

1. `rental_categories` — find-or-create (`is_active=true`, unique `slug`)
2. `rental_items` — see gap checklist
3. `rental_item_images` — `status='assigned'`; `tags='{}'`; `is_ai_cleaned=false`; set `display_order` 0..n
4. `rental_location_listings` — unique `(rental_item_id, business_location_id)`; **`moderation_status='approved'`**, **`is_active=true`**
5. `rental_listing_weekly_availability` — 7 weekdays (default Sun off; Mon–Sat `08:00:00`–`20:00:00`)

**Idempotency**:

- Soft-match existing item: same `business_id` + `lower(name)` + `deleted_at IS NULL` → **reuse** item; do not duplicate.
- If listing already exists for `(item, location)` → **skip** (or update prices only if user asked).
- Never silently create a second item with the same name.

**Images**:

- Remote URL → store as-is.
- Local file → Nest presign + PUT if JWT available; else ask for public URL.
- **0 images → always `blocked_ambiguous` (`missing_image`); never insert.**
- Prefer ≥2 image URLs per row when CSV has them (`image_url` + `image_url_2`, or pipe/comma-separated `image_urls`).

### 5) Done report

For each row: `rental_item_id`, `listing_id`, category id, image count, weekly rows ok?, skipped/error reason.

Remind: SQL import sets listings **`moderation_status='approved'`** and items/listings **`is_active=true`** (unless user asks for draft/review-first). Soft-deleted rows (`deleted_at`) must stay excluded from reuse unless user asks to restore. Nest publish still adds AI review / embeddings side effects if needed.

## Gap checklist

### `rental_items`

| Column | Value |
|--------|--------|
| `business_id` | From location |
| `rental_category_id` | Resolved UUID NOT NULL |
| `name` | Required |
| `description` | `''` if empty after AI |
| `tags` | `{}` or inferred |
| `currency` | Business currency (never trust CSV) |
| `operation_mode` | `business_operated` default; or `take_home` |
| `is_active` | `true` (only insert when ≥1 image exists; prefer ≥2) |
| `deleted_at` | NULL |

### `rental_location_listings`

| Column | Default if CSV blank |
|--------|----------------------|
| `base_price_per_hour` | Required > 0 |
| `base_price_per_day` | `hourly × 8` |
| `security_deposit_amount` | `hourly × 8` |
| `min_rental_hours` | `1` |
| `max_rental_hours` | NULL |
| `units_available` | `1` |
| `pickup_instructions` / `dropoff_instructions` | `''` |
| `is_active` | `true` |
| `moderation_status` | `'approved'` |
| `deleted_at` | NULL |

Do **not** leave listings in `draft` unless the user explicitly asks for review-first. Default import is **approved + active**.

### `rental_listing_weekly_availability`

| Weekday | Default |
|---------|---------|
| 0 (Sun) | `is_available=false`, times NULL |
| 1–6 | `is_available=true`, `08:00:00`–`20:00:00` |

Override from CSV only when explicit hours are provided.

## Prefer Nest when JWT is available

If the user supplies a **business Bearer token**:

1. `POST /api/rentals/business/items`
2. Images via `POST /api/rental-item-images` (or create-from-image)
3. `POST /api/rentals/business/listings` with `business_location_id`
4. Optional `POST /api/rentals/business/listings/:id/publish`
5. Optional admin approve

Use Secrets Manager + SQL when they asked for DB import, JWT is unavailable, or env has no convenient API auth. Details: [reference.md](reference.md).

## Guardrails

- **No ambiguity:** do not import a row (or guess fields) when unclear — see “No ambiguity” above.
- Confirm **prod** before any write.
- Never commit secrets or plan files with credentials.
- Do not create users or businesses; location must already exist.
- Do not write into sale `items` / `item_images` / `business_inventory`.
- Do not leave imported rentals inactive: set item/listing **`is_active=true`** and listing **`moderation_status='approved'`** unless the user explicitly asks for draft/review-first.
- Skip Nest migrations / Hasura seed SQL for tenant rental data.
