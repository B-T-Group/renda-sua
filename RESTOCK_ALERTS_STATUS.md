# Restock Alerts Implementation Progress - PR-A (Backend)

## ✅ Completed Work

### 1. Hasura Migration (20261011140000_restock_alerts_v1)
- ✅ Feature flag `restock_alerts_v1` (default FALSE, country-level override support)
- ✅ Table `restock_alerts` for tracking alert states (armed/sent/disarmed)
- ✅ Table `restock_events` for debounce and processing
- ✅ Table `restock_alert_sends` for rate limiting and analytics
- ✅ Enum `restock_alert_status` with all required states
- ✅ User preference columns in `user_notification_preferences`
- ✅ `business_inventory.last_restocked_at` column
- ✅ Indexes for efficient queries

### 2. Core Services
- ✅ **InventoryRestockEventService** - Emits restock events on 0→>=1 transitions (fire-and-forget, never blocks)
- ✅ **RestockAlertsService** - Cron processor with:
  - 10-minute debounce (AC-2.2)
  - 24h user-item cooldown (AC-2.3)
  - 6h per-item fan-out cap (AC-2.4)
  - 3 alerts/user/24h cap (AC-2.5)
  - Quiet hours 21:00-08:00 (AC-2.7)
  - Re-verify stock before send (AC-2.8)
  - Single channel selection: push > WhatsApp > SMS (AC-2.9)
  - Quantity display when <=5 (AC-2.10)
- ✅ **RestockAlertStateService** - Manages arm/disarm on likes/purchases
- ✅ **RestockAlertsController** - API for user preferences

### 3. Integration Points Completed
- ✅ `BusinessItemsService.updateInventoryItem()` - Emits restock events
- ✅ `BusinessItemsService.createInventoryItem()` - Emits restock events
- ✅ `ItemLikesService.setLike()` - Arms/disarms alerts on like/unlike
- ✅ Module wiring (InventoryRestockModule → AppModule, ItemLikesModule, BusinessItemsModule)
- ✅ Backend builds successfully (`nx build backend` passes)

## 🚧 Remaining Work for PR-A

### Critical Integration Points (HIGH PRIORITY)
1. **Inventory Release on Order Cancel/Complete** ⚠️ REQUIRED
   - Modify `release-reserved-inventory.util.ts` to accept InventoryRestockEventService
   - Call from `OrderCleanupService.decrementReservedQuantities()`
   - Call from all other order completion/cancellation paths
   - After each release, emit restock events for affected inventory

2. **Order Creation Disarm** ⚠️ REQUIRED
   - Add `RestockAlertStateService` to OrdersService
   - Call `disarmAlertsForOrderItems()` after successful order creation
   - Ensures buying the item disarms the alert (AC-§1)

3. **Other Inventory Write Paths** (find all via grep)
   - Variant inventory updates (`variant-inventory.service.ts`)
   - Commerce integrations (`commerce-inventory-sync.service.ts`, `commerce-import.service.ts`)
   - Location transfers (`business-location-transfer.service.ts`)
   - Stock availability updates (`stock-availability.service.ts`)
   - Any admin/system scripts that update inventory

### Tests (REQUIRED)
Write comprehensive unit tests covering:
- ✅ AC-0: Event emission never blocks inventory write
- ✅ AC-0: Event emitted on every write path where qty goes 0→>=1
- ✅ AC-2.1: One alert per user-item per transition
- ✅ AC-2.2: 10-minute debounce
- ✅ AC-2.3: 24h cooldown
- ✅ AC-2.4: 6h fan-out cap
- ✅ AC-2.5: 3/day cap + digest
- ✅ AC-2.7: Quiet hours queueing
- ✅ AC-2.8: Re-verify before send
- ✅ AC-2.9: Single channel
- ✅ AC-2.10: Quantity in copy
- ✅ §1: OOS-only arming, not in cart/order
- ✅ §1: 90-day expiry
- ✅ §1: Unlike/purchase disarms
- Concurrency (two instances, idempotency)

### Documentation
- Update `docs/platform-capabilities.md` with:
  - New restock alerts capability (web + mobile)
  - User preferences API endpoints
  - Feature flag and config
  - Money flows (if any)

### PR Description
- List all inventory write paths covered
- Explain how to test on DEV (flag is OFF by default)
- Document WhatsApp template pending approval
- Note any open questions

## Known Open Questions
1. **WhatsApp Template** - Pending Meta approval for template `rs_restock_alert` (documented in PR)
2. **Digest Implementation** - AC-2.6 says combined message for 2+ items within 60min - currently mentioned but not fully implemented (defer or complete?)
3. **Analytics Integration** - Which analytics service to use for restock.* events?
4. **Deep Links** - Need to verify correct deep link format/service method

## Next Steps (Priority Order)
1. ❌ Complete inventory release integration (order cancel/complete)
2. ❌ Complete order creation disarm integration
3. ❌ Find and integrate remaining inventory write paths
4. ❌ Write comprehensive unit tests
5. ❌ Update docs/platform-capabilities.md
6. ❌ Test locally (Hasura migration + API endpoints)
7. ❌ Create PR-A with detailed description
8. ❌ Start PR-B (frontend + mobile UI)

## PR-B Scope (Separate Branch)
Not yet started. Will need:
- Web: Bell UI, filters, settings
- Mobile: Bell UI, filters, settings
- EN/FR translations
- Frontend/mobile tests
- Build verification

## Files Changed (PR-A)
```
apps/hasura/migrations/Rendasua/20261011140000_restock_alerts_v1/up.sql
apps/hasura/migrations/Rendasua/20261011140000_restock_alerts_v1/down.sql
apps/backend/src/inventory-restock/inventory-restock-event.service.ts
apps/backend/src/inventory-restock/restock-alerts.service.ts
apps/backend/src/inventory-restock/restock-alert-state.service.ts
apps/backend/src/inventory-restock/restock-alerts.controller.ts
apps/backend/src/inventory-restock/inventory-restock.module.ts
apps/backend/src/app/app.module.ts
apps/backend/src/business-items/business-items.service.ts
apps/backend/src/business-items/business-items.module.ts
apps/backend/src/item-likes/item-likes.service.ts
apps/backend/src/item-likes/item-likes.module.ts
```

## How to Continue
1. Read the remaining integration points above
2. Search for all inventory write paths: `rg "update_business_inventory|insert_business_inventory|release.*inventory" --type ts`
3. Integrate InventoryRestockEventService into each path
4. Write tests for all ACs
5. Update docs
6. Create PR with comprehensive description
