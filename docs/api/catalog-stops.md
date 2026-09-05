# Catalog Stops API - Final Implementation

## Overview

Implements mid-feed "stop" rails matching **exact Frontend/Mobile contracts** under `/catalog/stops/*`. These additive endpoints let FE/Mobile compose discovery content without overloading the existing `inventory-items` backbone.

---

## ✅ Locked Contracts Implemented

### Base Path: `/catalog/stops`

All endpoints are **public** (`@Public()`), return empty arrays on empty state, and support common query params: `country_code`, `state`, `origin_lat`, `origin_lng`, `limit`.

---

## 1. Top in Category

**Endpoint:** `GET /catalog/stops/top-in-category`

**Query Parameters:**
- `category` (optional): Category name filter
- `subcategory` (optional): Subcategory name filter  
- `country_code` (optional): Country code (CM, GA, etc.)
- `state` (optional): State/province filter
- `origin_lat`/`origin_lng` (optional): Anonymous coordinates
- `limit` (optional): Max items (default 8, max 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "category_name": "Electronics",
    "items": [] // CatalogInventoryItem[] - same shape as GET /inventory-items
  },
  "message": "Top items in category retrieved successfully"
}
```

**Sorting:** Relevance/top_rated within category (avg_rating DESC, viewsCount DESC).

---

## 2. Deals Near You

**Endpoint:** `GET /catalog/stops/deals`

**Query Parameters:** `country_code`, `state`, `origin_lat`, `origin_lng`, `limit` (default 8, max 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [] // CatalogInventoryItem[] with hasActiveDeal: true
  },
  "message": "Active deals retrieved successfully"
}
```

**Notes:** Only deal-active inventory rows (from `item_deals` table). Same item shape as `/inventory-items`.

---

## 3. Essentials / Collections

**Endpoint:** `GET /catalog/stops/essentials`

**Query Parameters:** `country_code`, `state`, `limit` (default 8, max 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "collections": [] // CollectionSummary[] - featured only
  },
  "message": "Featured collections retrieved successfully"
}
```

**Type:** Reuses `CollectionSummary` from `collections.service.ts`.

---

## 4. Featured Store

**Endpoint:** `GET /catalog/stops/featured-store`

**Query Parameters:** `country_code`, `state`, `limit` (default 1, max 5)

**Response:**
```json
{
  "success": true,
  "data": {
    "stores": [] // TopInventoryStoreRow[] - catalog store shape
  },
  "message": "Featured stores retrieved successfully"
}
```

**Type:** Reuses `TopInventoryStoreRow` from `inventory-items.service.ts`.

**Fields:** `business_location_id`, `name`, `logo_url`, `item_count`, `is_verified`, `can_accept_orders`, `is_storefront_visible`, etc.

---

## 5. Bag Complements

**Endpoints:**
- `POST /catalog/stops/bag-complements`
- `GET /catalog/stops/bag-complements` (query string alternative)

**POST Body:**
```json
{
  "inventory_item_ids": ["uuid1", "uuid2"],
  // or
  "item_ids": ["uuid1", "uuid2"]
}
```

**GET Query:**
- `inventory_item_ids`: Comma-separated IDs
- `item_ids`: Alternative comma-separated IDs
- `country_code`, `state`, `limit` (default 6, max 12)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [ // CatalogInventoryItem[] with optional reason_label
      {
        ...inventoryItem,
        "reason_label": "Popular in same category" // optional
      }
    ]
  },
  "message": "Bag complement items retrieved successfully"
}
```

**v1 Logic:** Category-based heuristic. Returns empty array if weak BE signal (FE can heuristic).

---

## Type Reuse (Existing Nest Types)

| Stop | Response Type | Source |
|------|---------------|--------|
| Top in category | `InventoryItem[]` | `inventory-items.service.ts` |
| Deals | `InventoryItem[]` | `inventory-items.service.ts` |
| Essentials | `CollectionSummary[]` | `collections.service.ts` |
| Featured store | `TopInventoryStoreRow[]` | `inventory-items.service.ts` |
| Bag complements | `InventoryItem[]` | `inventory-items.service.ts` |

---

## Common Features

### Envelope
All endpoints return:
```typescript
{
  success: boolean;
  data: { [key]: [] }; // Empty arrays on empty state
  message: string;
}
```

### Empty State Handling
FE can safely omit rails: empty results return `{ items: [] }` or `{ collections: [] }` or `{ stores: [] }` — **never errors**.

### Country/Fulfillment Scoping
- All endpoints support `country_code` (CM, GA, + diaspora)
- Optional `state` for province-level filtering
- Optional `origin_lat`/`origin_lng` for anonymous distance (v1: not used for distance calc, reserved for future)

### Authentication
- All endpoints: `@Public()` (no auth required)
- Optional `RequestContext` for future user-specific features

---

## Testing

```bash
$ npx nx test backend --testPathPattern=catalog-stops
✅ Test Suites: 2 passed (controller + service)
✅ Tests: 24 passed, 24 total
✅ Time: 0.691s
```

```bash
$ npx nx build backend
✅ Successfully ran target build for project backend
```

---

## Hard Constraints Met

- ✅ **Additive only:** New `/catalog/stops` endpoints, zero changes to `inventory-items`
- ✅ **Empty states:** Return empty arrays, FE can omit rails
- ✅ **Type reuse:** `InventoryItem`, `CollectionSummary`, `TopInventoryStoreRow`
- ✅ **No schema changes:** Uses only existing Hasura tables
- ✅ **Food mode:** Retail stops won't break food paths (no food-specific blocking)
- ✅ **Restock out of scope:** v1.5+
- ✅ **Tests passing:** 24/24
- ✅ **Swagger docs:** Complete OpenAPI specs

---

## Schema Impact

**No Hasura/schema changes required.**

Uses existing tables:
- `business_inventory`
- `item_deals`
- `business_locations`
- `items`
- `item_sub_categories`
- `collections`
- `rating_aggregates`

---

## Frontend Integration Examples

### React/TypeScript

```typescript
// Top in category
const { data } = await fetch(
  '/api/catalog/stops/top-in-category?category=Electronics&country_code=GA&limit=8'
).then(r => r.json());

if (data.items.length > 0) {
  <Rail title={data.category_name}>
    {data.items.map(item => <ProductCard key={item.id} item={item} />)}
  </Rail>
}

// Deals
const deals = await fetch('/api/catalog/stops/deals?country_code=GA&limit=8')
  .then(r => r.json());

if (deals.data.items.length > 0) {
  <DealsRail items={deals.data.items} />
}

// Essentials
const essentials = await fetch('/api/catalog/stops/essentials?limit=8')
  .then(r => r.json());

if (essentials.data.collections.length > 0) {
  <CollectionsRail collections={essentials.data.collections} />
}

// Featured store
const stores = await fetch('/api/catalog/stops/featured-store?country_code=GA&limit=1')
  .then(r => r.json());

if (stores.data.stores.length > 0) {
  <FeaturedStoreSpotlight store={stores.data.stores[0]} />
}

// Bag complements (POST)
const complements = await fetch('/api/catalog/stops/bag-complements', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inventory_item_ids: cartItems.map(i => i.id),
  }),
}).then(r => r.json());

if (complements.data.items.length > 0) {
  <ComplementsRail items={complements.data.items} />
}
```

---

## Known Limitations (v1)

1. **Distance calculation:** Not implemented in v1 (reserved params for future)
2. **Bag complements:** Simple category-based heuristic (ML-based "frequently bought together" is v1.5+)
3. **Store verification:** `is_verified` returns `false` (verification system TBD)
4. **Collection counts:** `listing_count` returns `0` (requires separate query to count)

---

## Future Enhancements (v1.5+)

1. **Restock from Order History:**
   - `GET /catalog/stops/restock-suggestions`
   - Based on user's previous orders

2. **ML-Based Complements:**
   - Collaborative filtering on `order_items` co-occurrence
   - Real-time personalization

3. **Distance Calculation:**
   - Use `origin_lat`/`origin_lng` + user primary address
   - Sort by distance for "near you" features

4. **Personalization:**
   - User-specific top categories
   - Browsing history integration
   - A/B testing different rail strategies

---

## PR & Links

- **PR:** https://github.com/B-T-Group/renda-sua/pull/238
- **Branch:** `cursor/discovery-rails-feed-3ae3`
- **Module:** `apps/backend/src/catalog-stops/`
- **Status:** Ready for review

---

## Success Criteria ✅

- [x] Exact path: `/catalog/stops/*`
- [x] Reuse existing types: `InventoryItem`, `CollectionSummary`, `TopInventoryStoreRow`
- [x] Response shapes match FE/Mobile specs
- [x] Empty states return empty arrays (FE can omit rails)
- [x] Common query params: `country_code`, `state`, `origin_lat`, `origin_lng`, `limit`
- [x] All endpoints `@Public()`
- [x] No schema changes
- [x] Tests passing (24/24)
- [x] Build successful
- [x] Swagger docs complete

---

**Implementation Date:** September 5, 2026  
**Final Contracts:** Locked with Frontend & Mobile  
**Status:** ✅ Ready for Frontend integration
