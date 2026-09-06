# Store Interrupted-Feed Option B – Web Parity Note

## Status

**Mobile v1**: ✅ Shipped ([mobile-rendasua#32](https://github.com/GROUPE-B-T/mobile-rendasua/pull/32))  
**Backend APIs**: ✅ Additive (`/catalog/stops/*`) merged ([renda-sua#238](https://github.com/B-T-Group/renda-sua/pull/238))  
**Web Frontend**: ⏳ Not yet implemented

---

## Overview

The Store browse experience on web needs to match mobile's interrupted-feed UX (Option B), which places contextual **mid-feed stops** in the Store grid—not just in the header rail.

This document tracks the **web parity gap** and provides implementation guidance for a future frontend implementer.

---

## Locked UX Requirements (Option B)

### Layout
- **Dense 2-column Store grid** with mid-feed stops inserted at natural breakpoints
- Stops appear **within the grid flow**, not only at the top
- Each stop is a horizontal rail (similar to mobile) spanning both columns

### Stop Types (in priority order)
1. **Goes with your bag** – Complementary items based on cart contents
2. **Top in [category]** – Popular items within the current browsing category
3. **Deals** – Promotional or discounted items
4. **Essentials / Collections** – Curated merchant collections
5. **Featured store** – Spotlight a specific store/merchant

### Business Rules
- **Suppress stops** when user applies search query or filters
- **Food mode unchanged** – Food browse retains existing UX (no interruptions)
- **Never show blank rails** – Hide stops with zero items
- **Restock logic** – Planned for v1.5 (not in initial scope)

---

## Backend Endpoints (Already Available)

All endpoints live under `/catalog/stops/*` and are documented in [PR #238](https://github.com/B-T-Group/renda-sua/pull/238).

### Key Endpoints
- `GET /catalog/stops/goes-with-bag` – Items that complement current cart
- `GET /catalog/stops/top-in-category/:categoryId` – Top items for a category
- `GET /catalog/stops/deals` – Active deals and promotions
- `GET /catalog/stops/essentials` – Curated essentials/collections
- `GET /catalog/stops/featured-store/:storeId` – Featured merchant spotlight

### Request Patterns
- Accepts query params for pagination (`limit`, `offset`)
- Returns stop metadata (title, type, priority) + item array
- Items follow standard catalog item schema

---

## Implementation Checklist

### Frontend Work
- [ ] Create `StoreInterruptedFeed` component or refactor existing Store grid layout
- [ ] Wire up `/catalog/stops/*` endpoints using `useApiClient` or domain-specific hooks
- [ ] Implement 2-column grid with mid-feed rail insertion logic
- [ ] Add conditional rendering: hide stops on search/filter, skip food mode
- [ ] Handle empty states (never render blank rails)
- [ ] Add loading skeletons for stop rails
- [ ] Ensure responsive behavior (mobile web should match native mobile UX)

### Testing
- [ ] Verify stops render correctly in 2-column grid
- [ ] Confirm stops are hidden during search/filter
- [ ] Test each stop type (Goes with bag, Top in category, Deals, etc.)
- [ ] Validate food mode is unaffected
- [ ] Check performance with multiple mid-feed stops

### Acceptance Criteria
✅ Dense 2-column Store grid with mid-feed stops  
✅ All 5 stop types render correctly with real data  
✅ Stops suppressed on search/filter  
✅ Food browse mode unchanged  
✅ No blank/empty rails ever displayed  
✅ Responsive on mobile web (matches native mobile UX)

---

## Notes

- **Design alignment**: Mobile UX is the source of truth ([PR #32](https://github.com/GROUPE-B-T/mobile-rendasua/pull/32))
- **Restock logic**: Deferred to v1.5 (out of scope for initial web parity)
- **Backend contracts**: Stable; any breaking changes will be communicated via versioned endpoints

---

## References

- Mobile implementation: [GROUPE-B-T/mobile-rendasua#32](https://github.com/GROUPE-B-T/mobile-rendasua/pull/32)
- Backend additive APIs: [B-T-Group/renda-sua#238](https://github.com/B-T-Group/renda-sua/pull/238)
- Design spec: (Link to Figma/design doc if available)
