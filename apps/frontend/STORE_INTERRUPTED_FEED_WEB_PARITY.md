# Store Interrupted Feed (store-only rails)

## Status

**Backend**: `GET /inventory-items/stores/:businessId/browse-context`  
**Web**: Implemented on `StorePage` (`/store/:id`)  
**Mobile**: Implemented on `StoreDetailScreen`

---

## Overview

The public store page is a **store catalog**: search and category chips scoped to that location, plus mid-feed rails that only show inventory from **this store**.

Marketplace `/catalog/stops/*` rails (other stores, exports, bag complements) are **not** used on the store page.

---

## UX

### Layout
- Store header unchanged (name, logo, share, follow, owner preview)
- Search field + category chips (All + categories with inventory at this location)
- Dense product grid with full-width rails inserted after every **two rows** (`columns × 2` products on web; 4 products / 2 columns on mobile)

### Store-only stop types (priority order)
1. **Deals** — active deals at this location; “See all” sets `sort=deals`
2. **Popular in [category]** — up to three rails from the store’s largest categories (≥2 items)
3. **Collections** — platform collections with ≥1 sellable listing at this location; tap filters the store grid by `collection`

### Business rules
- Suppress all rails while search, category, collection, or deals sort is active
- Never show blank rails
- Food mode (`?menu=food` / `foodOnly`) uses the same UI with `food_only`
- Owner preview: main grid may include unavailable items; rails use the public sellable set
- Web uses infinite scroll; mobile uses `loadMore`

---

## API

`GET /inventory-items/stores/:businessId/browse-context`

Query: `food_only`, `owner_preview`, `lang`

Response: `{ business_location_id, categories, deals, popular, collections }`

Product list remains `GET /inventory-items` with `business_location_id` plus optional `search`, `category`, `collection`, `sort`.

---

## Key files

| Area | Path |
|------|------|
| Backend | `apps/backend/src/inventory-items/store-browse-context.service.ts` |
| Web page | `apps/frontend/src/components/pages/StorePage.tsx` |
| Web composer | `apps/frontend/src/utils/composeStoreFeed.ts` |
| Mobile screen | `apps/mobile/src/screens/shared/StoreDetailScreen.tsx` |
| Mobile composer | `apps/mobile/src/hooks/useStoreFeedComposition.ts` |
