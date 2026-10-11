# Restock Alerts Implementation Status

## Overview
Issue #343: Restock alerts for liked items - V1 (restock only, no price/store alerts)

## PR-A: Backend + Hasura + Flag + Tests

### ✅ Completed
1. **Hasura Migration** (`20261011140000_restock_alerts_v1`)
   - Feature flag `restock_alerts_v1` (default FALSE)
   - Tables: `restock_alerts`, `restock_events`, `restock_alert_sends`
   - Enums: `restock_alert_status`
   - User preferences columns added to `user_notification_preferences`
   - `business_inventory.last_restocked_at` column added

2. **Core Services Created**
   - `InventoryRestockEventService` - Emits restock events on inventory transitions (0→>=1)
   - `RestockAlertsService` - Cron-based processor with debounce, caps, cooldowns, quiet hours
   - `RestockAlertStateService` - Manages alert arm/disarm on likes/purchases
   - `RestockAlertsController` - API for user preferences

3. **Module & DI**
   - Created `InventoryRestockModule`
   - Wired into `AppModule`

### 🚧 In Progress / TODO

#### A. Integration Points (HIGH PRIORITY)
Must integrate `InventoryRestockEventService.emitRestockEventIfApplicable()` into ALL inventory write paths:

1. **Business Items Service** (`business-items.service.ts`)
   - `updateItem()` - Direct inventory updates
   - `updateItemFromImage()` - AI-generated inventory updates
   - `bulkImportFromCsv()` - Bulk imports
   - `publishItemFromImage()` - Publish flow

2. **Orders Service** (`orders.service.ts`, `release-reserved-inventory.util.ts`)
   - After `releaseReservedInventory()` calls (cancel, complete, failed delivery)
   - Hasura function `try_release_business_inventory` is the atomic release - need to emit after this

3. **Variant Inventory** (`variant-inventory.service.ts`)
   - All variant quantity updates

4. **Commerce Integrations** (`commerce-inventory-sync.service.ts`, `commerce-import.service.ts`)
   - Shopify/WooCommerce inventory sync
   - Bulk import flows

5. **Location Transfer** (`business-location-transfer.service.ts`)
   - Inventory transfers between locations

6. **Stock Availability** (`stock-availability.service.ts`)
   - Any direct availability changes

7. **Admin/System Scripts**
   - Check for any admin controllers that update inventory

#### B. Alert Arming/Disarming Integration
Must integrate `RestockAlertStateService` into:

1. **Item Likes** (`item-likes.service.ts`)
   - `setLike(liked=true)` → `armAlertOnLike()`
   - `setLike(liked=false)` → `disarmAlertOnUnlike()`

2. **Order Creation** (`orders.service.ts`)
   - After successful order creation → `disarmAlertsForOrderItems()`

#### C. Tests (REQUIRED)
Comprehensive unit tests covering all ACs:
- ✅ AC-0: Event emission on every write path (0→>=1 transition)
- ✅ AC-0: Emission never blocks inventory write (fire-and-forget)
- ✅ AC-2.1: One alert per user-item per transition
- ✅ AC-2.2: 10-minute debounce
- ✅ AC-2.3: 24h cooldown after send
- ✅ AC-2.4: 6h fan-out cap per item
- ✅ AC-2.5: 3 alerts/user/24h cap + digest
- ✅ AC-2.6: 60-min digest window
- ✅ AC-2.7: Quiet hours (21:00-08:00) queue to 08:00
- ✅ AC-2.8: Re-verify availability before send
- ✅ AC-2.9: Single channel (push > WhatsApp > SMS)
- ✅ AC-2.10: Quantity in copy when <=5
- ✅ §1: Qualifying likes (OOS only, not in cart/order, market visible)
- ✅ §1: Arm for 90 days, expire silently
- ✅ §1: Unlike/purchase disarms
- Concurrency tests (two instances, idempotency)

#### D. Documentation
- Update `docs/platform-capabilities.md` with restock alerts capabilities
- Document all inventory write paths covered in PR description

#### E. Build & Test Verification
- Run `nx build backend` - verify build succeeds
- Run `nx test backend` - verify existing tests pass
- Fix any TypeScript/lint errors

## PR-B: Frontend + Mobile UI + Translations

### TODO
1. **Web UI Components**
   - Bell icon on like cards (filled/outline/muted states)
   - Bell icon on PDP when sold out
   - 'Back in stock' chip on likes screen
   - Filter chips: All | Back in stock
   - Sort: in-stock first, then 'Back in stock', then OOS
   - Settings row under Notifications
   - Per-channel toggles (Push/WhatsApp/SMS)

2. **Mobile UI Components**
   - Same bell/chip/filter/sort as web
   - Settings screen integration

3. **Translations (EN/FR)**
   - Push notification copy (single item + digest)
   - SMS copy (<=160 chars)
   - WhatsApp template (pending approval)
   - In-app UI strings (bell states, chips, settings)
   - All `you`→`vous` in FR

4. **Frontend Tests**
   - Bell state changes
   - Filter/sort behavior
   - Settings integration

5. **Mobile Tests**
   - Same as frontend

6. **Build Verification**
   - `nx build frontend`
   - `nx build mobile`
   - `nx test frontend`
   - `nx test mobile`

## Inventory Write Paths - Complete Audit Required

Search patterns to find all paths:
```bash
# Direct updates
rg "update_business_inventory.*_set" --type ts
rg "insert_business_inventory" --type ts

# Service methods
rg "updateInventory|setQuantity|updateStock" --type ts

# Hasura functions
rg "try_release_business_inventory" --type ts
```

### Known Paths (from grep)
1. `business-items.service.ts` - Multiple update methods
2. `orders.service.ts` - Release reserved after cancel/complete
3. `order-cleanup.service.ts` - System cleanup jobs
4. `order-system-jobs.service.ts` - Auto-decline cleanup
5. `variant-inventory.service.ts` - Variant updates
6. `stock-availability.service.ts` - Availability checks
7. `commerce-inventory-sync.service.ts` - External sync
8. `commerce-import.service.ts` - Bulk import
9. `business-location-transfer.service.ts` - Transfers

### Integration Pattern
Every method that writes to `business_inventory` must:

```typescript
// 1. Import the service
private readonly inventoryRestockEvent: InventoryRestockEventService

// 2. After writing quantity, emit event (fire-and-forget)
await this.inventoryRestockEvent.emitRestockEventIfApplicable({
  inventoryId,
  itemId,
  businessLocationId,
  previousAvailableQuantity, // quantity - reserved BEFORE update
  newTotalQuantity,
  newReservedQuantity,
});
```

## Open Questions
1. WhatsApp template pending Meta approval - document this clearly
2. Short link service for SMS/WhatsApp deep links - use existing deep link service?
3. Digest implementation - defer to follow-up or implement in V1?
4. Analytics integration - which analytics service to use?

## Next Steps
1. Complete integration into all inventory write paths (A)
2. Integrate alert arming/disarming (B)
3. Write comprehensive tests (C)
4. Update documentation (D)
5. Verify build & tests (E)
6. Commit and push PR-A
7. Start PR-B (frontend/mobile)
