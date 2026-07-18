# Onboard demo client — API & env reference

## Why Nest REST, not migrations

| Approach | Verdict |
|----------|---------|
| Hasura migration / seed SQL | **No** — schema/versioned seeds; hardcoded UUIDs; skips location accounts, currency, moderation, image library |
| Nest REST + business JWT | **Yes** — same path as the app; side effects preserved |
| Agent `curl`/`fetch` per step | Fine for one-off demos |
| Checked-in reusable CLI | Optional later under `apps/backend/scripts/` if this becomes frequent |

## Environments

| | Dev | Prod |
|--|-----|------|
| GraphQL | `https://hasura-dev.rendasua.com/v1/graphql` | `https://hasura.rendasua.com/v1/graphql` |
| Nest API | Dev backend base URL used by the app (from `apps/backend/.env.development` / deploy config) | Prod backend base URL |
| Default business email | `besongsamueloru+user@gmail.com` | `tech@rendasua.com` |
| Secrets | `HASURA_GRAPHQL_ADMIN_SECRET` in env files / Secrets Manager — **never echo** | same |

Resolve Nest base URLs from the running app config or ask the user (e.g. `https://api-dev.rendasua.com` / `https://api.rendasua.com` — confirm against current deploy docs if unsure).

## Auth

- Business JWT: `Authorization: Bearer <access_token>`
- Login: `POST /login/start-otp` → user OTP → `POST /login/verify-otp`
- Test-user password realm may apply for configured test emails (`Auth0Service.verifyTestUserEmail`) — only if that path is enabled for the account; prefer user-provided token or OTP.
- Admin approve: platform admin JWT on `/admin/items/:itemId/approve`

## Endpoints (sale catalog)

| Step | Method / path | Body highlights |
|------|----------------|-----------------|
| Create location | `POST /business-items/locations` | `name`, `address: { address_line_1, city, state, postal_code? }`, optional `phone`, `email`, `location_type`, `is_primary` |
| Presign image | `POST /aws/presigned-url/image` | `bucketName`, `originalFileName`, `contentType`, optional `prefix` (e.g. `items/library`) |
| Register library images | `POST /business-images/bulk` | `{ images: [{ image_url, s3_key?, … }] }` |
| Create item from image | `POST /business-items/create-from-image` | `imageId`, `name`, optional `categoryName`, `subCategoryName`, `brandName`, `description`, `price` |
| Alt: create item | `POST /business-items/items` | `CreateItemDto` — needs `item_sub_category_id`; starts draft / inactive |
| Inventory | `POST /business-items/inventory` | `business_location_id`, `item_id`, `quantity`, `reserved_quantity`, `reorder_point`, `reorder_quantity`, `unit_cost`, `selling_price`, `is_active` |
| Publish | `POST /business-items/items/:id/publish` | — |
| Admin approve | `POST /admin/items/:itemId/approve` | admin JWT |

Controllers: `apps/backend/src/business-items/business-items.controller.ts`, `business-images`, `aws`, `admin/admin.controller.ts`.

## Lookup business by email (admin GraphQL example)

Use Hasura admin secret for **read-only** resolution:

```graphql
query BusinessByEmail($email: String!) {
  users(where: { email: { _ilike: $email } }, limit: 1) {
    id
    email
    business { id name }
  }
}
```

## Image upload sequence

1. `POST /aws/presigned-url/image` → `{ url, key }` (field names as returned by `AwsService`)
2. `PUT` binary to presigned URL with matching `Content-Type`
3. Public URL typically `https://{bucket}.s3.{region}.amazonaws.com/{key}` (match app convention / response)
4. `POST /business-images/bulk` then `create-from-image`

Bucket/region: from backend env (`S3_BUCKET_NAME` / `S3_IMAGES_BUCKET_NAME`, `S3_BUCKET_REGION`).

## Code pointers

- Location create: `business-items.service.ts` → `createBusinessLocation` (+ `ensureAccountForBusinessLocation`)
- Create from image: `CreateItemFromImageDto`
- Seeds (do **not** copy for prod demos): `apps/hasura/seeds/Rendasua/`
