# Import location rentals — reference

## CSV columns

Header names are case-insensitive. Aliases in parentheses are accepted.

### Strongly recommended

| Column | Aliases | Notes |
|--------|---------|--------|
| `name` | `title`, `item_name`, `product_name` | Required after AI |
| `base_price_per_hour` | `hourly_price`, `price_per_hour`, `hourly` | Listing hourly rate |
| `base_price_per_day` | `daily_price`, `price_per_day`, `day_rate`, `all_day_price` | Flat all-day rate |
| `units_available` | `units`, `quantity`, `qty` | Concurrent identical units; default `1` |
| `image_url` | `image`, `photo_url`, `url` | Prefer ≥1 HTTPS URL; missing → insert inactive |
| `image_url_2` | `image_2`, `photo_url_2` | Second image (prefer ≥2) |
| `image_urls` | `images`, `photos` | Pipe `\|` or comma-separated list |

### Optional item fields

| Column | Aliases | Notes |
|--------|---------|--------|
| `description` | `desc`, `details` | AI fills if blank |
| `rental_category` | `category`, `category_name` | Maps to `rental_categories` (not sale taxonomy) |
| `rental_category_id` | | Use only if known valid UUID |
| `operation_mode` | `mode` | `business_operated` (default) or `take_home` |
| `tags` | | Comma/pipe-separated → `text[]` |
| `currency` | | **Ignored** — business currency wins |

### Optional listing fields

| Column | Aliases | Notes |
|--------|---------|--------|
| `security_deposit_amount` | `deposit`, `security_deposit` | Default = `8 × hourly` |
| `min_rental_hours` | `min_hours` | Default `1` |
| `max_rental_hours` | `max_hours` | Optional NULL |
| `pickup_instructions` | `pickup` | Default `''` |
| `dropoff_instructions` | `dropoff`, `return_instructions` | Default `''` |
| `image_path` / `image_path_2` | `local_image` | Needs upload or public URL |

### Optional weekly availability

| Column | Notes |
|--------|--------|
| `weekly_hours` | Free-text; AI/normalize to 7 weekday rows if clear |
| `mon_hours` … `sun_hours` | e.g. `08:00-20:00` or `closed` |

If omitted, use Nest defaults: Sunday closed; Mon–Sat `08:00:00`–`20:00:00`.

`business_location_name` is **not** required when `business_location_id` is passed (location is fixed).

## Domain differences vs sale import

| Concern | Sale (`import-location-products`) | Rentals (this skill) |
|---------|-----------------------------------|----------------------|
| Catalog | `items` | `rental_items` |
| Location row | `business_inventory` | `rental_location_listings` |
| Taxonomy | `item_categories` → `item_sub_categories` (+ brands) | Flat `rental_categories` |
| Images | `item_images` | `rental_item_images` |
| Price | One-time `price` / `selling_price` | Hourly + day + deposit |
| Stock | `quantity` | `units_available` + weekly hours |
| SKU | Per business | **None** |
| Moderation | Item-level | **Listing**-level (`draft` default) |
| Min images to activate | 1 | **2** |

## Seeded rental categories

Fixed UUIDs from migration `1808000000000_create_rentals_domain`:

| Name | Slug | Id |
|------|------|----|
| Vehicles | `vehicles` | `a0000001-0001-4000-8000-000000000001` |
| Equipment | `equipment` | `a0000001-0001-4000-8000-000000000002` |
| Events | `events` | `a0000001-0001-4000-8000-000000000003` |
| Other | `other` | `a0000001-0001-4000-8000-000000000004` |

Prefer matching these before creating new categories. New categories need unique `slug` (NFKD → ascii → kebab, max 60; append `-2`, `-3`, … on conflict).

## SQL insert order

```
rental_categories (optional create)
  → rental_items
    → rental_item_images
      → rental_location_listings
        → rental_listing_weekly_availability (7 rows)
```

## Location + currency validation

```sql
-- Prefer joining the business primary address used in this env.
-- Fallback path if b.address_id is null: location address or owner user address.
SELECT bl.id AS location_id,
       bl.name AS location_name,
       bl.business_id,
       b.name AS business_name,
       a.country
FROM public.business_locations bl
JOIN public.businesses b ON b.id = bl.business_id
LEFT JOIN public.addresses a ON a.id = b.address_id
WHERE bl.id = $1::uuid;
```

Map country → currency the same way Nest does (`CA`→`CAD`, CFA markets→`XAF`, etc.). Lock `rental_items.currency` to that value.

## Taxonomy load

```sql
SELECT id, name, slug, display_order, is_active
FROM public.rental_categories
WHERE is_active = true
ORDER BY display_order, name;
```

Find-or-create category:

```sql
-- Match by lower(name) first; else insert with unique slug
INSERT INTO public.rental_categories (name, slug, display_order, is_active)
VALUES ($name, $slug, $next_order, true)
RETURNING id;
```

## Item insert

```sql
INSERT INTO public.rental_items (
  business_id, rental_category_id, name, description, tags,
  currency, operation_mode, is_active
) VALUES (
  $business_id, $category_id, $name, $description, $tags,
  $currency, COALESCE($operation_mode, 'business_operated'),
  true
)
RETURNING id;
```

## Image insert

`rental_item_images` has **no** `image_type` column (unlike sale `item_images`). Status enum: `unassigned` | `assigned` | `archived`.

```sql
INSERT INTO public.rental_item_images (
  business_id, rental_item_id, rental_category_id,
  image_url, s3_key, alt_text, caption,
  tags, status, display_order, is_ai_cleaned
) VALUES (
  $business_id, $rental_item_id, $category_id,
  $image_url, NULL, $alt, NULL,
  '{}', 'assigned', $order, false
);
```

Inspect live columns before insert (thumbnails / validation / rembg columns have defaults).
## Listing insert

```sql
INSERT INTO public.rental_location_listings (
  rental_item_id, business_location_id,
  pickup_instructions, dropoff_instructions,
  base_price_per_hour, base_price_per_day, security_deposit_amount,
  min_rental_hours, max_rental_hours, units_available,
  is_active, moderation_status
) VALUES (
  $item_id, $location_id,
  '', '',
  $hourly, $daily, $deposit,
  COALESCE($min_h, 1), $max_h, COALESCE($units, 1),
  true, 'approved'
)
RETURNING id;
```

Unique: `(rental_item_id, business_location_id)` where not soft-deleted — check before insert.

## Weekly availability insert

```sql
INSERT INTO public.rental_listing_weekly_availability
  (listing_id, weekday, is_available, start_time, end_time)
VALUES
  ($id, 0, false, NULL, NULL),
  ($id, 1, true, '08:00:00', '20:00:00'),
  ($id, 2, true, '08:00:00', '20:00:00'),
  ($id, 3, true, '08:00:00', '20:00:00'),
  ($id, 4, true, '08:00:00', '20:00:00'),
  ($id, 5, true, '08:00:00', '20:00:00'),
  ($id, 6, true, '08:00:00', '20:00:00')
ON CONFLICT ON CONSTRAINT rental_listing_weekly_availability_unique
DO UPDATE SET
  is_available = EXCLUDED.is_available,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time;
```

Confirm constraint name on the target DB if `ON CONFLICT` fails.

## Preview plan JSON shape

```json
{
  "env": "prod",
  "business_location_id": "…",
  "business_id": "…",
  "currency": "CAD",
  "country": "CA",
  "rows": [
    {
      "source_row": 2,
      "action": "create",
      "name": "…",
      "description": "…",
      "rental_category": { "mode": "existing", "id": "…", "name": "Equipment" },
      "operation_mode": "business_operated",
      "tags": ["generator"],
      "base_price_per_hour": 25,
      "base_price_per_day": 150,
      "security_deposit_amount": 200,
      "units_available": 1,
      "min_rental_hours": 1,
      "max_rental_hours": null,
      "images": [
        { "mode": "url", "image_url": "https://…" },
        { "mode": "url", "image_url": "https://…" }
      ],
      "weekly_availability": "default_nest",
      "notes": []
    }
  ]
}
```

Actions: `create` | `reuse_item_create_listing` | `skip_duplicate_listing` | `skip_no_price` | `skip_unavailable` | `blocked_ambiguous`.

For `blocked_ambiguous`, include `ambiguity_reason` (required). Never promote a blocked row to `create` without an explicit user resolution.

## Nest alternative (JWT)

| Step | Endpoint |
|------|----------|
| Categories | `GET /api/rentals/categories`, `POST /api/rentals/categories` |
| Create item | `POST /api/rentals/business/items` |
| Images | `POST /api/rental-item-images` (library / assign) |
| Create listing | `POST /api/rentals/business/listings` |
| Publish | `POST /api/rentals/business/listings/:id/publish` (`draft`→`pending` + AI queue) |
| Admin approve | `POST /api/admin/rental-listings/:id/approve` |

DTO reference:

- `apps/backend/src/rentals/dto/create-business-rental-item.dto.ts`
- `apps/backend/src/rentals/dto/create-business-rental-listing.dto.ts`
- `apps/backend/src/rentals/rentals.service.ts` (`createBusinessRentalItem`, `createBusinessRentalListing`)

## Why SQL skips some Nest side effects

Direct inserts do **not** automatically:

- Queue rental listing AI review
- Run image validation / thumbnail / rembg pipelines
- Enforce the ≥2-image activation gate in app code
- Flip `moderation_status` past `draft` (import skill defaults to **approved** + **active**; Nest publish still adds AI side effects)

After SQL import, user may ask to publish/approve via Nest or admin tools.

## Related skills / code

- [import-location-products](../import-location-products/SKILL.md) — sale catalog (do not mix tables)
- Migrations: `apps/hasura/migrations/Rendasua/1808000000000_create_rentals_domain/`
- Nest: `apps/backend/src/rentals/`, `apps/backend/src/rental-item-images/`
