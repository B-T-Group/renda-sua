---
name: surgical-category-cleanup
description: >-
  Clean up item_categories and item_sub_categories (duplicates, test junk,
  case inconsistency) using surgical remapping. Always remap items/subcats
  to canonical targets before deleting empties. Use when asked to clean up
  categories, dedupe categories, normalize category names, or remove test
  categories in prod/dev.
---

# Surgical Category Cleanup (prod | dev)

Clean up `item_categories` and `item_sub_categories`: duplicates, test junk, case inconsistency.

## Critical Constraint

**SURGICAL:** Never delete a category/subcategory that still has items (or child subcategories). Always remap items (and subcategory parents) to a canonical target first. Schema uses `ON DELETE RESTRICT`.

## Resolve Environment

| User says | Env | Secrets Manager secret |
|-----------|-----|------------------------|
| prod / production | `prod` | `production-rendasua-backend-secrets` |
| dev / development | `dev` | `development-rendasua-backend-secrets` |

If ambiguous, ask once. Default region: `ca-central-1`.

## Workflow

### Phase 1: Inventory

Generate CSV reports:
- All categories/subcategories with item counts
- Duplicate groups by `lower(trim(name))`
- Case variants
- Test/junk candidates

```bash
cd /Users/besongsamuel/Documents/Github/rs/rendasua/tools/surgical-category-cleanup
chmod +x run.sh   # once if needed
./run.sh prod inventory
# or
./run.sh dev inventory
```

**Output:** `./reports/*.csv` files

### Phase 2: Plan

Generate `remap_plan.json` proposing `from_id → to_id` remaps.

**Canonical selection:**
1. Highest item count
2. Title Case preference
3. Lowest ID tie-breaker

```bash
./run.sh prod plan
```

**Output:** `./reports/remap_plan.json`

### Phase 3: Dry Run

Review what would happen:

```bash
./run.sh prod apply --dry-run
# With delete empties
./run.sh prod apply --dry-run --delete-empty
```

### Phase 4: Apply Remaps

Execute the plan:

```bash
# Without delete
./run.sh prod apply

# With delete empties (recommended)
./run.sh prod apply --delete-empty
```

**Actions:**
1. Remap `items.item_sub_category_id` for duplicate subcategories
2. Remap `item_sub_categories.item_category_id` for duplicate categories
3. Delete now-empty categories/subcategories (with `--delete-empty`)

### Phase 5: Normalize Names

Normalize to Title Case:

```bash
# Dry run
./run.sh prod normalize --dry-run

# Apply
./run.sh prod normalize
```

### Phase 6: Re-run Product Taxonomy Mapping

After cleanup, refresh Google/FB product category mappings:

```bash
cd ../embed-product-taxonomy
./run-map.sh prod --min-similarity 0.45
```

See `.cursor/skills/map-product-taxonomy/SKILL.md` for details.

## Manual Fallback (if run.sh missing)

1. Ensure venv + deps under `tools/surgical-category-cleanup`.
2. Export `DATABASE_URL` from the env's secret JSON key `DATABASE_URL` (do not echo it).
3. Run:

```bash
python category_cleanup.py inventory
python category_cleanup.py plan
python category_cleanup.py apply --dry-run --delete-empty
python category_cleanup.py apply --delete-empty
python category_cleanup.py normalize
```

## Verify

After cleanup, check coverage:

```sql
-- Category counts
SELECT COUNT(*) AS total_categories FROM public.item_categories;

-- Subcategory counts
SELECT COUNT(*) AS total_subcategories FROM public.item_sub_categories;

-- Items with valid subcategories
SELECT COUNT(*) AS total_items FROM public.items;

-- Check for orphaned items (should be 0)
SELECT COUNT(*) AS orphaned_items
FROM public.items i
LEFT JOIN public.item_sub_categories s ON i.item_sub_category_id = s.id
WHERE s.id IS NULL;
```

After Phase 6 (taxonomy mapping), verify coverage:

```sql
SELECT count(*) AS total,
       count(fb_product_category) AS with_fb,
       count(google_product_category) AS with_google
FROM public.item_sub_categories;
```

## Safety

- Confirm **prod** before writing if the user did not explicitly say prod.
- Never delete categories/subcategories with items (ON DELETE RESTRICT enforced).
- Always review `--dry-run` output before applying.
- Never commit `.env*` or secrets. Local `.venv` stays untracked.
- Never echo `DATABASE_URL` or passwords.

## Schema FK References

**`item_sub_categories` references:**
- `item_sub_categories.item_category_id` → `item_categories.id` (ON DELETE RESTRICT)

**`items` references:**
- `items.item_sub_category_id` → `item_sub_categories.id` (ON DELETE RESTRICT)

**Note:** `rental_categories` is a separate domain, not related to `item_categories`.

## Integration with Existing Tools

- `tools/embed-product-taxonomy/` - Run Phase 6 after cleanup
- `apps/backend/src/categories/match-item-category.ts` - Name normalization helpers (reference)

## Commands

### `inventory`

Generate CSV reports.

**Options:**
- `--output-dir DIR` - Output directory (default: `./reports`)

### `plan`

Generate remap plan.

**Options:**
- `--output-dir DIR` - Output directory (default: `./reports`)

### `apply`

Apply remap plan.

**Options:**
- `--output-dir DIR` - Output directory (default: `./reports`)
- `--dry-run` - Show what would happen
- `--delete-empty` - Delete empty categories after remapping

### `normalize`

Normalize names to Title Case.

**Options:**
- `--dry-run` - Show what would happen

## Typical Usage

```bash
cd tools/surgical-category-cleanup

# 1. Inventory
./run.sh prod inventory

# 2. Plan
./run.sh prod plan

# 3. Dry run
./run.sh prod apply --dry-run --delete-empty

# 4. Apply (if dry run looks good)
./run.sh prod apply --delete-empty

# 5. Normalize
./run.sh prod normalize --dry-run
./run.sh prod normalize

# 6. Re-run taxonomy mapping
cd ../embed-product-taxonomy
./run-map.sh prod --min-similarity 0.45
```

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `Connection refused` | Ensure VPN/network to RDS |
| `Access denied` | Check AWS credentials for Secrets Manager |
| `ON DELETE RESTRICT` | Items still reference the category; check inventory |
| No duplicates found | May already be clean |

## Out of Scope

- Do not run against prod from cloud agents (no secrets).
- Do not delete data without user confirmation.
- `rental_categories` is separate (not covered by this tool).
