# Import location products — reference

## CSV columns

Header names are case-insensitive. Aliases in parentheses are accepted.

### Strongly recommended

| Column | Aliases | Notes |
|--------|---------|--------|
| `name` | `title`, `product_name`, `product` | Required after AI |
| `price` | `catalog_price`, `list_price` | Catalog `items.price` |
| `selling_price` | `sale_price` | Inventory selling price; default = `price` |
| `quantity` | `qty`, `stock` | Default `10` |
| `image_url` | `image`, `photo_url`, `url` | Public HTTPS preferred |
| `image_path` | `local_image`, `photo` | Relative/absolute file; needs upload or conversion to URL |

### Optional product fields

| Column | Aliases | Notes |
|--------|---------|--------|
| `description` | `desc`, `details` | AI fills if blank |
| `sku` | `product_sku`, `code` | Unique per `business_id` |
| `brand` | `brand_name`, `marque` | Find-or-create `brands` |
| `category` | `category_name`, `item_category` | Top-level taxonomy |
| `subcategory` | `sub_category`, `sub_category_name` | Linked via `item_sub_category_id` |
| `item_sub_category_id` | | Use only if known valid id |
| `currency` | | **Ignored** — business currency wins |
| `unit_cost` | `cost`, `buy_price` | Default `0` |
| `reorder_point` | | Default `0` |
| `reorder_quantity` | | Default `0` |
| `reserved_quantity` | | Default `0` |
| `weight` | | Numeric |
| `weight_unit` | | e.g. `kg`, `g`, `lb` |
| `dimensions` | | Free text |
| `color` | `colour` | |
| `model` | | |
| `is_used` | `used`, `second_hand` | Boolean |
| `is_fragile` / `is_perishable` / `requires_special_handling` | | Boolean |
| `min_order_quantity` / `max_order_quantity` | | Defaults 1 / 10 |
| `image_alt_text` / `image_caption` | | |

`business_location_name` is **not** required when `business_location_id` is passed to the skill (location is fixed). Ignore a CSV location column unless the user asks to multi-location import.

## SQL insert order

```
item_categories (optional create)
  → item_sub_categories (optional create)
    → brands (optional create)
      → items
        → item_images
          → business_inventory
```

## Location validation query

```sql
SELECT bl.id AS location_id,
       bl.name AS location_name,
       bl.business_id,
       b.name AS business_name,
       b.currency
FROM public.business_locations bl
JOIN public.businesses b ON b.id = bl.business_id
WHERE bl.id = $1::uuid;
```

## Taxonomy load

```sql
SELECT c.id AS category_id, c.name AS category_name,
       s.id AS subcategory_id, s.name AS subcategory_name
FROM public.item_categories c
JOIN public.item_sub_categories s ON s.item_category_id = c.id
WHERE c.status = 'active' AND s.status = 'active'
ORDER BY c.name, s.name;
```

Find-or-create category:

```sql
INSERT INTO public.item_categories (name, description, status)
VALUES ($1, '', 'active')
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
RETURNING id;
```

(`name` is UNIQUE on `item_categories`. Subcategories are not uniquely constrained by name globally — match by `(item_category_id, lower(name))` before insert.)

## Item insert (minimal ready draft)

```sql
INSERT INTO public.items (
  business_id, name, description, item_sub_category_id,
  price, currency, sku, brand_id,
  status, moderation_status, is_active, ai_review_version, is_used,
  min_order_quantity, max_order_quantity,
  pay_on_delivery_enabled, shipping_enabled, stripe_tax_code_id
) VALUES (
  $business_id, $name, $description, $subcategory_id,
  $price, $currency, $sku, $brand_id,
  'active', 'draft', false, 0, coalesce($is_used, false),
  1, 10,
  $pay_on_delivery, false, 'txcd_99999999'
)
RETURNING id;
```

## Image insert

```sql
INSERT INTO public.item_images (
  business_id, item_id, image_url, s3_key,
  image_type, status, tags, is_ai_cleaned, is_active,
  alt_text, caption
) VALUES (
  $business_id, $item_id, $image_url, $s3_key,
  'main', 'assigned', '{}', false, true,
  $alt, $caption
);
```

## Inventory insert

```sql
INSERT INTO public.business_inventory (
  business_location_id, item_id, item_variant_id,
  quantity, reserved_quantity, reorder_point, reorder_quantity,
  unit_cost, selling_price, is_active
) VALUES (
  $location_id, $item_id, NULL,
  $qty, 0, 0, 0,
  $unit_cost, $selling_price, true
)
ON CONFLICT DO NOTHING;  -- rely on unique (location, item) when variant is null; adjust if constraint name differs
```

If `ON CONFLICT` target is unclear, select existing inventory for `(business_location_id, item_id)` where `item_variant_id IS NULL` and UPDATE instead.

## Preview plan JSON shape

```json
{
  "env": "dev",
  "business_location_id": "…",
  "business_id": "…",
  "currency": "XAF",
  "rows": [
    {
      "source_row": 2,
      "action": "create",
      "name": "…",
      "description": "…",
      "price": 5000,
      "selling_price": 5000,
      "quantity": 10,
      "unit_cost": 0,
      "sku": "IMP-…",
      "category": { "mode": "existing", "id": 1, "name": "Retail" },
      "subcategory": { "mode": "create", "name": "Phones", "category_id": 1 },
      "brand": { "mode": "existing", "id": "…", "name": "…" },
      "image": { "mode": "url", "image_url": "https://…" },
      "pay_on_delivery_enabled": true,
      "notes": []
    }
  ]
}
```

## Nest alternative (JWT)

| Step | Endpoint |
|------|----------|
| Presign | `POST /aws/presigned-url/image` |
| Library | `POST /business-images/bulk` |
| Create | `POST /business-items/create-from-image` |
| Inventory | `POST /business-items/inventory` (`business_location_id` required) |
| Bulk CSV | `POST /business-items/csv-upload` (resolves location by **name**, not id) |
| Publish | `POST /business-items/items/:id/publish` |
| Approve | `POST /admin/items/:itemId/approve` |

DTO reference: `apps/backend/src/business-items/dto/csv-upload.dto.ts`, `create-item-from-image.dto.ts`.

## Why SQL skips some Nest side effects

Direct inserts do **not** automatically:

- Queue AI moderation / embeddings
- Run image cleanup pipeline
- Ensure location ledger accounts (location already exists)
- Flip `moderation_status` to `approved`

After SQL import, user may ask to publish/approve via Nest or admin tools.

## Related skills

- [onboard-demo-client](../onboard-demo-client/SKILL.md) — scrape website → Nest JWT demo seed
- [map-product-taxonomy](../map-product-taxonomy/SKILL.md) — fill Google/FB ids on subcategories after new taxonomy rows exist
