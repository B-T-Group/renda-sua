---
name: onboard-demo-client
description: Onboard a demo merchant by creating a business location and 5–10 real catalog products (with images) in both hasura-dev and prod for a given business account, scraped from an external items page. Use when the user asks to onboard a demo client, seed a demo store, or populate products from a merchant website for besongsamueloru+user@gmail.com (dev) or tech@rendasua.com (prod).
---

# Onboard demo client

Create a **business location** and **5–10 real sale products** (images + inventory) for an existing business account in **both** environments, using a merchant items page as the source of truth.

## Defaults

| Env | Business account email |
|-----|------------------------|
| **dev** | `besongsamueloru+user@gmail.com` |
| **prod** | `tech@rendasua.com` |

Override only if the user names different accounts.

## Approach (do this — not migrations)

**Use Nest REST APIs with the business user’s JWT** (agent-driven `curl`/`fetch`, or a short one-off script under `scripts/` that you run).

**Do not** use Hasura migrations or seed SQL for tenant demo data. Migrations are schema-only; seeds use hardcoded sample UUIDs and skip Nest side effects (location ledger accounts, business currency, moderation, image library rules).

Details: [reference.md](reference.md).

## Required inputs

1. **Items page URL** (or pasted HTML / list of products) for the merchant catalog.
2. **Location details** (name + address: line1, city, state; postal optional; phone/email optional). Ask if missing.
3. **Auth for each env**:
   - Preferred: user pastes a **Bearer access token** for the business account (and a **platform admin** token if items must be approved immediately).
   - Else: drive `POST /login/start-otp` + `POST /login/verify-otp` and ask the user for the OTP.
4. Confirm **both** envs unless the user scopes to one.

Never commit passwords, OTPs, or tokens. Never print admin secrets from `.env*`.

## Workflow checklist

Copy and track:

```
Demo onboard:
- [ ] Scrape / select 5–10 products + images
- [ ] Auth (dev business JWT [, admin JWT])
- [ ] Create location (dev)
- [ ] Create products + inventory (dev)
- [ ] Publish + approve (dev)
- [ ] Auth (prod)
- [ ] Create location (prod)
- [ ] Create products + inventory (prod)
- [ ] Publish + approve (prod)
- [ ] Summarize IDs / URLs for the user
```

### 1) Scrape the items page

- Open the URL (browser tools or `WebFetch`). Prefer real product cards: name, price, description, image URL, category hints.
- Pick **5–10** distinct products (diverse, in-stock looking). Skip junk / nav / promo banners.
- Write a local plan JSON (temp or `scripts/plans/<slug>.json`) shaped like [scripts/product-plan.example.json](scripts/product-plan.example.json).
- **Images**: download each product image to a temp dir when the URL works.
  - If no usable image → generate a simple product photo with the **GenerateImage** tool (white/studio background, product-focused, no text overlays), save the file, use that for upload.
  - Prefer scraped images over generated ones.

### 2) Per environment (dev, then prod)

API bases — see [reference.md](reference.md). Load matching backend env only for Hasura admin fallback; prefer Nest + JWT.

1. Resolve business for the account email (Hasura admin query or Nest profile endpoint). Stop if missing.
2. **Location**: `POST /business-items/locations` with `name` + nested `address` (country comes from business primary address).
3. For each product in the plan:
   1. Presign: `POST /aws/presigned-url/image`
   2. `PUT` image bytes to the presigned URL
   3. `POST /business-images/bulk` with the public S3 URL / key
   4. `POST /business-items/create-from-image` with `imageId`, `name`, optional `categoryName` / `subCategoryName` / `brandName` / `description` / `price`
   5. `POST /business-items/inventory` at the new location (sensible demo qty, e.g. 10–25; `selling_price` = catalog price)
   6. `POST /business-items/items/:id/publish`
   7. If admin JWT available: `POST /admin/items/:itemId/approve` so the item is live for demos
4. Idempotency: before creating, check existing items by name for that business; skip or rename with a short suffix if already present. Do not duplicate locations with the same name unless the user asks.

### 3) Done report

For each env: business id, location id, list of item ids + names, image source (scraped vs generated), moderation status, any failures.

## Guardrails

- Target **existing** business accounts only; do not sign up new users unless asked.
- Keep prices numeric in the business currency Nest will apply.
- Methods/scripts stay small; reuse Nest endpoints rather than raw SQL.
- If prod write fails auth or policy, stop and report — do not silently fall back to admin SQL inserts for catalog rows.
- Optional Hasura admin GraphQL is only for **lookups** (user → business) unless the user explicitly allows admin inserts.
