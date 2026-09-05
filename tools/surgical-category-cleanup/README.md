# Surgical Category Cleanup

Python tool for cleaning up `item_categories` and `item_sub_categories` in Rendasua: duplicates, test junk, case inconsistency.

## Critical Constraint

**SURGICAL:** Never delete a category/subcategory that still has items (or child subs). Always remap items (and subcategory parents) to a canonical target first. Schema uses `ON DELETE RESTRICT`.

## Production Scale (as of Sep 2026)

- **382 categories**, **1,250 subcategories**, **10,342 items**
- Categories/subcategories have `status` field: `active` or `draft`
- **42 empty subcategories** (0 items)
- **~420/422** of 1,250 subs have fb/google taxonomy mapped

### Known Production Duplicates

**Categories (case-only):**
- `vêtements` (381 items)
- `soins de la peau` (105 items)
- `mode` (21 items)

**Subcategories (same parent):**
- `eau de parfum` (113 items)

**Known Junk:**
- Category ID 420: `T`
- Subcategory ID 579: `T`

## Prerequisites

- Python 3.10+ recommended.
- AWS CLI credentials with `secretsmanager:GetSecretValue` for `production-rendasua-backend-secrets` or `development-rendasua-backend-secrets` (region: `ca-central-1`).
- Network access to RDS.

## Setup

```bash
cd tools/surgical-category-cleanup
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Workflow

### Phase 1: Inventory

Generate CSV reports showing:
- All categories/subcategories with item counts
- Duplicate groups by `lower(trim(name))`
- Case variants (same normalized name, different casing)
- Test/junk candidates (names containing "test", "demo", etc.)

```bash
# Via wrapper (recommended)
./run.sh prod inventory
./run.sh dev inventory

# Manual
export DATABASE_URL="<connection-string>"
python category_cleanup.py inventory --output-dir ./reports
```

**Output files** (in `./reports/`):
- `categories.csv` - all categories with item counts
- `subcategories.csv` - all subcategories with item counts
- `category_duplicates.csv` - duplicate category groups
- `subcategory_duplicates.csv` - duplicate subcategory groups
- `category_case_variants.csv` - categories with case inconsistencies
- `subcategory_case_variants.csv` - subcategories with case inconsistencies
- `category_test_junk.csv` - likely test/junk categories
- `subcategory_test_junk.csv` - likely test/junk subcategories

### Phase 2: Plan

Generate remap plan (`remap_plan.json`) proposing `from_id → to_id` remaps.

**Canonical selection rules:**
1. Highest item count (most used)
2. Status: `active` > `draft` > others
3. Title Case preference (better formatting)
4. Lowest ID (tie-breaker)

```bash
./run.sh prod plan
./run.sh dev plan

# Manual
python category_cleanup.py plan --output-dir ./reports
```

**Output:** `remap_plan.json` with category and subcategory remaps.

### Phase 3: Dry Run

Review what would happen without making changes:

```bash
./run.sh prod apply --dry-run
./run.sh dev apply --dry-run

# With delete
./run.sh prod apply --dry-run --delete-empty
```

### Phase 4: Apply Remaps

Execute the remap plan:

```bash
# Without delete
./run.sh prod apply

# With delete (removes empty categories after remapping)
./run.sh prod apply --delete-empty
```

**What happens:**
1. **Subcategory remaps:** Update `items.item_sub_category_id` to point to canonical subcategory
2. **Category remaps:** Update `item_sub_categories.item_category_id` to point to canonical category
3. **Optional delete:** Remove now-empty categories/subcategories (with `--delete-empty`)

Note: When merging categories, items stay with their subcategories (no direct item update needed).

### Phase 5: Normalize Names

Normalize all names to Title Case:

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

## Manual Usage (without wrapper)

Export `DATABASE_URL` from Secrets Manager:

```bash
export DATABASE_URL=$(
  aws secretsmanager get-secret-value \
    --secret-id production-rendasua-backend-secrets \
    --region ca-central-1 \
    --query SecretString \
    --output text \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_URL"])'
)
```

Then run commands:

```bash
python category_cleanup.py inventory
python category_cleanup.py plan
python category_cleanup.py apply --dry-run
python category_cleanup.py apply --delete-empty
python category_cleanup.py normalize
```

## Commands

### `inventory`

Generate inventory reports.

**Options:**
- `--output-dir DIR` - Output directory (default: `./reports`)

**Output:** CSV files with all categories, duplicates, case variants, and test junk candidates.

### `plan`

Generate remap plan from duplicates.

**Options:**
- `--output-dir DIR` - Output directory (default: `./reports`)

**Output:** `remap_plan.json` with proposed remaps.

### `apply`

Apply remap plan.

**Options:**
- `--output-dir DIR` - Output directory (default: `./reports`)
- `--dry-run` - Show what would happen without making changes
- `--delete-empty` - Delete empty categories/subcategories after remapping

**Requires:** `remap_plan.json` from `plan` command.

### `normalize`

Normalize names to Title Case using `INITCAP(TRIM(name))`.

**Options:**
- `--dry-run` - Show what would happen without making changes

## Safety

- **Confirm prod before writing** if not explicitly requested.
- Never delete categories/subcategories with items (ON DELETE RESTRICT enforced).
- Always review `--dry-run` output before applying changes.
- Never commit `.env*` or secrets. Local `.venv` stays untracked.
- Never echo `DATABASE_URL` or passwords in logs.

## Schema FK References

**IMPORTANT:** Items do NOT have a direct category FK. Remap path:

1. **`items.item_sub_category_id`** → `item_sub_categories.id` (ON DELETE RESTRICT)
2. **`item_sub_categories.item_category_id`** → `item_categories.id` (ON DELETE RESTRICT)

**Merging categories means:**
- Remap all child subcategories' `item_category_id` to the canonical category
- Items automatically follow their subcategory (no direct item remap needed for category merges)

**Merging subcategories means:**
- Remap all items' `item_sub_category_id` to the canonical subcategory

**Note:** `rental_categories` is a separate domain, not related to `item_categories`.

## Integration with Existing Tools

This tool integrates with:
- `tools/embed-product-taxonomy/` - Run Phase 6 to refresh taxonomy mappings after cleanup
- `apps/backend/src/categories/match-item-category.ts` - Name normalization / fuzzy match helpers (reference for canonical naming)

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `Connection refused` | Ensure VPN/network access to RDS, verify `DATABASE_URL` |
| `Access denied` | Check AWS credentials, verify IAM permissions for Secrets Manager |
| `ON DELETE RESTRICT` error | Items still reference the category; review inventory reports |
| Poor duplicate detection | Adjust normalization logic in `find_duplicates()` |

## Example Workflow

```bash
# 1. Generate inventory
./run.sh prod inventory

# 2. Review reports in ./reports/
cat reports/category_duplicates.csv
cat reports/subcategory_duplicates.csv

# 3. Generate remap plan
./run.sh prod plan

# 4. Review plan
cat reports/remap_plan.json

# 5. Dry run
./run.sh prod apply --dry-run --delete-empty

# 6. Apply (if dry run looks good)
./run.sh prod apply --delete-empty

# 7. Normalize names
./run.sh prod normalize --dry-run
./run.sh prod normalize

# 8. Re-run product taxonomy mapping
cd ../embed-product-taxonomy
./run-map.sh prod --min-similarity 0.45
```
