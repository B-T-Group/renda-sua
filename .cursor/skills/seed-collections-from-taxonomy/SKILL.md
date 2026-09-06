---
name: seed-collections-from-taxonomy
description: >-
  Seed platform collections from the top categories/subcategories by active
  inventory listings (prod or dev), assign sample items, refresh thin featured
  essentials, and verify the essentials rail. Use when asked to create more
  collections, fill essentials, or seed collections from taxonomy.
---

# Seed collections from taxonomy (prod | dev)

Creates `collections` + `item_collections` from categories/subcategories with the most active storefront listings. Also tops up thin essentials (`baby-essentials`, `cleaning-essentials`, `back-to-school-essentials`) via keyword matching.

## Resolve environment

| User says | Env | Backend secret | Hasura |
|-----------|-----|----------------|--------|
| prod | `prod` | `production-rendasua-backend-secrets` | `hasura.rendasua.com` + `hasura-prod-admin` |
| dev | `dev` | `development-rendasua-backend-secrets` | `hasura-dev.rendasua.com` + `hasura-dev-admin` |

Default region: `ca-central-1`.

## Workflow

```bash
cd /Users/besongsamuel/Documents/Github/rs/rendasua/tools/seed-collections-from-taxonomy
chmod +x run.sh
./run.sh prod discover
./run.sh prod plan
./run.sh prod apply --dry-run
# After review:
./run.sh prod apply --confirm YES
```

### Commands

| Command | Effect |
|---------|--------|
| `discover` | Top categories/subcategories + existing collection counts → `reports/discover.json` |
| `plan` | Proposed new/refresh collections → `reports/plan.json` |
| `apply --dry-run` | Print actions only |
| `apply --confirm YES` | Insert missing collections; link up to 8 items each (idempotent) |

## Safety

- Default is dry-run / plan only.
- Prod apply requires `--confirm YES`.
- Skips junk names (`t`, `test`, `other`, …).
- Requires ≥4 sample items before creating a collection.
- `item_collections` uses `on_conflict do nothing`.
- Does not delete existing collections or memberships.

## After apply

Re-check featured counts via Hasura and smoke `GET /api/catalog/stops/essentials?country_code=CM` on the target API.
