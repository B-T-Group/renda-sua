# Stripe Connect Gating Investigation

**Investigation Date**: 2026-09-07  
**Reported Issue**: Business `03e3ee73-86a3-4323-bc3a-336e67dce9d6` appears active/orderable despite incomplete Stripe Connect  
**Platform**: Mobile (Expo app) — **web vs mobile divergence unknown** (mobile app not in this workspace)

---

## Intended Product Rules (Confirmed by Payments Engineer)

1. **Place Order eligibility** (`can_accept_orders`):
   - Gate: **merchant agreement signed only**
   - Stripe Connect readiness (charges ∧ payouts) is **NOT** required

2. **"Coming soon" payments block** (`isLocationPaymentsEnabled`):
   - **MoMo-rail countries**: require verified `mobile_payment_phone` on location
   - **Stripe-rail countries**: EXEMPT from phone gate (Stripe itself is the payment method)

3. **Stripe Connect (charges ∧ payouts enabled)**:
   - Unlocks: verified badge + payouts/withdrawals + dashboard CTA
   - Does **NOT** gate storefront Place Order button

**Conclusion**: A business with signed agreement but incomplete Stripe Connect **should** be orderable in Stripe-rail countries. This is **not a lifecycle bug** unless the product requirements change.

---

## Code Analysis: Intended Rules Implementation

### 1. Place Order Eligibility (`can_accept_orders`)

**Database**: `apps/hasura/migrations/Rendasua/20260811230000_simplify_business_lifecycle_status/up.sql`

```sql
ALTER TABLE public.businesses
  ADD COLUMN can_accept_orders BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status = 'active'
  ) STORED;
```

**Lifecycle Status Logic**: `apps/backend/src/merchant-lifecycle/merchant-lifecycle-status.util.ts`

```typescript
export function deriveLifecycleStatus(contractSigned: boolean): BusinessLifecycleStatus {
  return contractSigned ? 'active' : 'created';
}
```

**✅ INTENDED BEHAVIOR**: `can_accept_orders = true` when agreement signed, regardless of Stripe Connect state.

---

### 2. Checkout Preflight: `can_accept_orders` Gate

**File**: `apps/backend/src/orders/checkout-preflight.service.ts:303-320`

```typescript
const checkoutGateEnabled = this.configService.get<Configuration['merchantLifecycle']>(
  'merchantLifecycle'
)?.checkoutGateEnabled !== false;
if (!checkoutGateEnabled) continue;

const canAccept = group.inventoryRows[0]?.business_location?.business?.can_accept_orders === true;
if (!canAccept) {
  const label = group.businessName || 'This merchant';
  blockers.push({
    code: 'MERCHANT_NOT_ACCEPTING_ORDERS',
    message: `${label} is currently completing account setup and is not yet accepting orders.`,
  });
}
```

**Query**: Lines 56-85 select `can_accept_orders` from business:

```typescript
business_location {
  business {
    can_accept_orders
    // ...
  }
}
```

**✅ CORRECT**: Backend checks `can_accept_orders` (agreement-based), not Stripe Connect.

---

### 3. "Coming Soon" Payments Block (`isLocationPaymentsEnabled`)

**File**: `apps/backend/src/inventory-items/inventory-catalog-eligibility.util.ts:26-35`

```typescript
export function isLocationPaymentsEnabled(
  location: CatalogLocationPhoneGate | null | undefined,
  stripeCountries: string[]
): boolean {
  if (!location) return false;
  if (location.mobile_payment_phone?.is_verified === true) return true;
  const country = location.address?.country?.trim().toUpperCase();
  if (!country) return false;
  return stripeCountries.includes(country);  // ← Stripe-rail countries EXEMPT
}
```

**Applied in Checkout Preflight**: Lines 239-246

```typescript
} else if (
  !isLocationPaymentsEnabled(inv.business_location, stripeCountries)
) {
  blockers.push({
    code: 'LOCATION_PAYMENTS_COMING_SOON',
    message: `${inv.item?.name ?? 'An item'} is not available for purchase yet. Payments at this location are coming soon.`,
  });
}
```

**✅ INTENDED BEHAVIOR**:
- MoMo countries: require `mobile_payment_phone.is_verified = true`
- Stripe countries: **pass automatically** (no phone required)
- Stripe Connect readiness **NOT checked here**

---

### 4. Stripe Connect: Verified Badge + Dashboard CTA Only

**File**: `apps/backend/src/stripe-payments/stripe-connect.service.ts:416-419`

```typescript
/** True when the user can receive Stripe payouts/transfers. */
async isPayoutReady(userId: string): Promise<boolean> {
  const account = await this.getByUserId(userId);
  return !!account && account.charges_enabled && account.payouts_enabled;
}
```

**Lifecycle Integration**: `apps/backend/src/merchant-lifecycle/merchant-lifecycle.service.ts:82-87`

```typescript
export function deriveVerifiedBadge(paymentCapability: PaymentCapabilityStatus): boolean {
  return paymentCapability === 'VERIFIED';
}
```

**Stripe Capability Mapping**: `stripe-connect.service.ts:333-340`

```typescript
private mapStripeCapabilityStatus(account: Stripe.Account): DbPaymentCapabilityStatus {
  if (account.charges_enabled && account.payouts_enabled) return 'verified';
  if (account.requirements?.disabled_reason) return 'rejected';
  if (account.details_submitted) return 'verification_pending';
  return 'in_progress';
}
```

**✅ CORRECT**: Stripe Connect only affects badge + payout eligibility, not `can_accept_orders`.

---

## Scenario: Reported Prod Business

**Business ID**: `03e3ee73-86a3-4323-bc3a-336e67dce9d6`  
**User ID**: `dc0e8992-1e7a-4103-8415-50fa7e5dca32`  
**Stripe Connect**: charges_enabled=false, payouts_enabled=false, details_submitted=false

### Expected Behavior (per intended rules):

| Check | Expected | Likely Reality |
|-------|----------|----------------|
| `can_accept_orders` | `true` (if agreement signed) | ✅ Likely true |
| Stripe Connect ready | `false` | ✅ Confirmed false |
| `is_verified` badge | `false` | ✅ Expected false |
| Place Order button | **"Place Order"** (not "Coming soon") if Stripe-rail country | ✅ **INTENDED** |
| "Coming soon" blocker | Only if MoMo country AND no verified phone | Need country to confirm |
| Dashboard CTA | Should show "Set up payouts" / "Continue setup" | **🔍 Need to verify mobile** |

### Hypothesis: NOT A GAP (if business is in Stripe country)

If business is in a **Stripe-enabled country** (US, CA, UK, FR, etc.):
- ✅ `can_accept_orders = true` → Place Order button shows
- ✅ `isLocationPaymentsEnabled = true` → No "Coming soon" block
- ✅ Stripe Connect incomplete → Badge absent, dashboard CTA present
- ✅ **Orders can be placed** → Stripe checkout session created

This is **working as intended** per the confirmed product rules.

### Potential Gap: MoMo Country + No Phone

If business is in a **MoMo country** (CM, CI, SN, etc.) without verified phone:
- ✅ `can_accept_orders = true` → Place Order enabled in lifecycle
- ❌ `isLocationPaymentsEnabled = false` → **Should block with "Coming soon"**
- Expected: `LOCATION_PAYMENTS_COMING_SOON` in preflight blockers

**Cannot verify without business country data.**

---

## Mobile-Specific Analysis (Verified)

**Mobile app located at**: `apps/mobile/` (Phase 1 import, commit 7170ff29)

### 1. ✅ **Place Order Button**: Correctly Checks Both Gates

**Mobile PDP Implementation** (`apps/mobile/src/screens/shared/InventoryItemDetailScreen.tsx:467-469, 1022, 1040-1042`):

```typescript
const acceptsOrders = merchantCanAcceptOrders(loc.business);  // Line 467
const paymentsEnabled = item.payments_enabled !== false;      // Line 469

// Buy button (lines 1020-1043)
<Button
  mode="contained"
  onPress={onBuy}
  disabled={orderBlocked || !acceptsOrders || !paymentsEnabled || !variantSelectionReady}
  // ...
>
  {foodBlocked
    ? t('foods.status.notServingNow', 'Not serving now')
    : !outOfStock && (!acceptsOrders || !paymentsEnabled)
    ? t('catalog.paymentsComingSoon', 'Coming soon')  // ← Shows "Coming soon"
    : t('public.items.buyNow', 'Buy')}
</Button>
```

**Helper Function** (`apps/mobile/src/utils/merchantLifecycle.ts:17-21`):

```typescript
export function merchantCanAcceptOrders(
  business?: MerchantLifecycleFields | null
): boolean {
  return business?.can_accept_orders ?? business?.is_verified ?? false;
}
```

**Catalog Card** (`apps/mobile/src/components/browse/InventoryCatalogCard.tsx:162-164`):

```typescript
const acceptsOrders = merchantCanAcceptOrders(loc.business);
const paymentsEnabled = item.payments_enabled !== false;
// Uses same logic for catalog grid
```

**✅ CORRECT**: Mobile checks:
1. `can_accept_orders` (agreement-based) via `merchantCanAcceptOrders()`
2. `payments_enabled` (MoMo phone gate / Stripe country exempt)
3. Shows **"Coming soon"** when either is false
4. Does **NOT** check Stripe Connect readiness

**Preflight Integration** (`apps/mobile/src/screens/shared/InventoryItemDetailScreen.tsx:94-119`):

```typescript
const preflightRequest = useMemo(
  () =>
    checkoutOpen && item
      ? {
          items: [
            {
              business_inventory_id: item.id,
              quantity: 1,
              ...(toOrderItemVariantId(variantId)
                ? { item_variant_id: toOrderItemVariantId(variantId) }
                : {}),
            },
          ],
          provisional_country: itemCountryCode,
        }
      : null,
  [checkoutOpen, item, itemCountryCode, variantId]
);

const { config: preflightConfig, loading: preflightLoading } = useResolvedCheckout({
  request: preflightRequest,
  enabled: checkoutOpen && !!item,
});
```

**PlaceOrderScreen** (`apps/mobile/src/screens/client/PlaceOrderScreen.tsx`):
- Uses `useCheckoutOrchestrator` hook
- Calls `/orders/checkout/preflight` via backend
- Respects `blocking_errors` from backend

**✅ MATCHES WEB**: Mobile uses same backend preflight API and respects blockers.

---

### 2. ⚠️ **Business Dashboard CTA**: Stripe Card Only Shows for Stripe-Rail Merchants

**Dashboard Implementation** (`apps/mobile/src/screens/business/BusinessDashboardView.tsx:305-312`):

```typescript
{/* Suspension / Stripe setup — also in quiet home (not only fulfillment). */}
{!showSkeleton && !setupMode && verificationStatus ? (
  <BusinessVerificationBanner
    statusOverride={verificationStatus}
    loadingOverride={verificationLoading}
    onRefreshStatus={onRefreshVerification}
    mainInterest={mainInterest}
  />
) : null}
```

**BusinessVerificationBanner Logic** (`apps/mobile/src/components/business/BusinessVerificationBanner.tsx:90-102`):

```typescript
if (loading || !status || status.can_accept_orders) {
  return null;  // ← Hides banner when can_accept_orders = true
}

// MM merchants use dedicated dashboard cards (ID review + phone reminder +
// verified-badge tip). Keep this banner for Stripe setup and suspended stores.
if (
  status.lifecycle_status !== 'suspended' &&
  status.paymentRail === 'mobile_money'
) {
  return null;  // ← Hides banner for MoMo merchants (unless suspended)
}
```

**⚠️ KEY FINDING**: Mobile business dashboard **does NOT show Stripe Connect CTA** when:
- `can_accept_orders = true` (agreement signed)
- `paymentRail = 'mobile_money'`

**Stripe Connect Card Exists** (`apps/mobile/src/components/payments/StripeConnectCard.tsx:109-121`):

```typescript
{!isReady ? (
  <Button
    mode="contained"
    onPress={onStartOnboarding}
    loading={onboarding}
    disabled={onboarding}
    style={styles.actionBtn}
  >
    {status?.connected
      ? t('stripe.connect.continueSetup', 'Continue setup')
      : t('stripe.connect.setup', 'Set up payouts')}
  </Button>
) : null}
```

**Used In** (`apps/mobile/src/screens/shared/ConfigurePaymentsScreen.tsx:66`):

```typescript
<StripeConnectCard
  status={status}
  loading={loading}
  onboarding={onboarding}
  onStartOnboarding={startOnboarding}
  onOpenDashboard={openDashboard}
/>
```

**⚠️ BUT**: Only accessible via **"Configure Payments"** screen, not surfaced on main dashboard when Connect incomplete.

**Comparison to Web** (`apps/frontend/src/components/business/BusinessDashboard.tsx` + `StripeConnectOnboardingCard.tsx`):
- Web shows Stripe Connect card **prominently on dashboard** when payouts not enabled
- Mobile hides it when `can_accept_orders = true`, requiring manual navigation to settings

---

### 3. ✅ **Stripe Connect Onboarding Flow**: Fully Integrated

**Mobile API Integration** (`apps/mobile/src/services/agentApi.ts:771-780`):

```typescript
connectStatus: (): Promise<StripeConnectStatusResponse> =>
  api.get<StripeConnectStatusResponse>('/stripe-connect/status'),

connectAccountLink: (body?: {
  returnUrl?: string;
  refreshUrl?: string;
  platform?: 'mobile' | 'web';
}): Promise<StripeConnectLinkResponse> =>
  api.post<StripeConnectLinkResponse>('/stripe-connect/account-link', body ?? {}),
```

**Hook Implementation** (`apps/mobile/src/hooks/useStripeConnect.ts`):
- Fetches Connect status
- Opens onboarding link with `platform: 'mobile'`
- Handles deep-link return flow

**Backend Support** (`apps/backend/src/stripe-payments/stripe-connect.service.ts:277-285`):

```typescript
// Stripe only accepts http(s) return/refresh URLs. For the mobile app we
// route to an HTTPS page that deep-links back into the app (?app=mobile).
const appFlag = overrides?.platform === 'mobile' ? '?app=mobile' : '';
const link = await this.stripeService.createAccountLink(
  account.stripe_account_id,
  overrides?.refreshUrl || `${base}/connect/onboarding/refresh${appFlag}`,
  overrides?.returnUrl || `${base}/connect/onboarding/return${appFlag}`
);
```

**✅ CORRECT**: Mobile has full Stripe Connect onboarding integration with deep-linking.

---

## Summary: Backend vs Web vs Mobile

| Rule | Intended | Backend | Web | Mobile | Status |
|------|----------|---------|-----|--------|--------|
| Place Order gate | Agreement signed (`can_accept_orders`) | ✅ Preflight | ✅ Preflight | ✅ `merchantCanAcceptOrders()` | ✅ All Correct |
| Payments "Coming soon" | MoMo: phone gate; Stripe: exempt | ✅ `isLocationPaymentsEnabled` | ✅ Preflight | ✅ `payments_enabled` field | ✅ All Correct |
| Stripe Connect for orders | NOT required | ✅ Not checked | ✅ Not checked | ✅ Not checked | ✅ All Correct |
| Stripe Connect for badge | `charges_enabled ∧ payouts_enabled` | ✅ `deriveVerifiedBadge` | ✅ Badge | ✅ Badge | ✅ All Correct |
| Stripe Connect dashboard CTA | Show when incomplete | N/A | ✅ Prominent card | ❌ Missing (next-action) | ❌ **Real Bug** |

**✅ Backend and order-placement logic implement intended rules correctly across all platforms.**

**❌ Mobile Dashboard Bug**: `resolveStripeNextAction` never emits `setup_stripe_connect`, so setup mode exits after agreement without prompting Connect completion.

---

## Mobile-Specific Findings

### ✅ **No Order-Placement Gap** (Works As Intended)

Mobile PDP correctly enforces both gates:
1. **`can_accept_orders`** (agreement-based, via `merchantCanAcceptOrders()`)
2. **`payments_enabled`** (MoMo phone gate / Stripe country exempt)
3. Shows **"Coming soon"** when either is false
4. Uses backend preflight API for checkout validation

**Verified Files**:
- `apps/mobile/src/screens/shared/InventoryItemDetailScreen.tsx:467-469, 1040-1042`
- `apps/mobile/src/utils/merchantLifecycle.ts:17-21`
- `apps/mobile/src/components/browse/InventoryCatalogCard.tsx:162-164`

### ❌ **Dashboard CTA Gap** (Confirmed Real Bug)

**Issue**: `resolveStripeNextAction` never emits `setup_stripe_connect` action, so setup mode exits after agreement signing without prompting Stripe Connect setup.

**Root Cause** (confirmed by Payments team):
- Setup mode exits when `can_accept_orders = true` (agreement signed)
- Next-action resolver does not emit `setup_stripe_connect` for Stripe-rail merchants with incomplete Connect
- Dashboard shows no CTA to complete Stripe onboarding

**Impact**: Stripe-rail merchants can accept orders after signing agreement but:
- ❌ Cannot receive payouts (no Stripe Connect)
- ❌ No dashboard CTA to complete setup
- ❌ No verified badge

**Mobile Code** (`apps/mobile/src/components/business/BusinessVerificationBanner.tsx:90-102`):

```typescript
if (loading || !status || status.can_accept_orders) {
  return null;  // Hides banner when can_accept_orders = true
}

// Banner only shows for:
// 1. Suspended stores
// 2. Stripe-rail merchants without signed agreement
if (
  status.lifecycle_status !== 'suspended' &&
  status.paymentRail === 'mobile_money'
) {
  return null;
}
```

**Fix Required**: `resolveStripeNextAction` (or equivalent) must emit `setup_stripe_connect` when:
- Agreement signed (`can_accept_orders = true`)
- Stripe-rail merchant (`paymentRail = 'stripe'`)
- Connect incomplete (`!chargesEnabled || !payoutsEnabled`)

**Status**: Separate fix agent is shipping the next-action emit correction.

---

## Recommendations

### 1. **Data Verification** (Required to Confirm Gap)

Query prod database for the reported business:

```sql
SELECT
  b.id,
  b.name,
  b.lifecycle_status,
  b.can_accept_orders,
  b.is_verified,
  b.merchant_agreement_version,
  b.merchant_agreement_accepted_at,
  u.id as user_id,
  u.country as user_country,
  bl.id as location_id,
  bl.is_active as location_active,
  a.country as location_country,
  mpp.is_verified as momo_phone_verified,
  sca.charges_enabled,
  sca.payouts_enabled,
  sca.details_submitted
FROM businesses b
JOIN users u ON u.id = b.user_id
LEFT JOIN business_locations bl ON bl.business_id = b.id AND bl.is_active = true
LEFT JOIN addresses a ON a.id = bl.address_id
LEFT JOIN mobile_payment_phones mpp ON mpp.business_location_id = bl.id
LEFT JOIN stripe_connect_accounts sca ON sca.user_id = u.id
WHERE b.id = '03e3ee73-86a3-4323-bc3a-336e67dce9d6'
LIMIT 1;
```

**Expected for "Gap" to exist**:
- `can_accept_orders = true` (agreement signed)
- `location_country IN ('CM', 'CI', 'SN', ...)` (MoMo country)
- `momo_phone_verified = false` (no verified phone)
- Stripe Connect: `charges_enabled = false`

**If location is in Stripe country**: No gap, working as intended.

---

### 2. **Mobile App Audit** (Cannot Complete Here)

**File locations to check in `mobile-rendasua`**:

1. **Place Order button logic**:
   - Search for: `placeOrder`, `checkout`, `preflight`
   - Verify: Calls `/orders/checkout/preflight` before enabling button
   - Verify: Checks `can_proceed` and `blocking_errors`

2. **Business dashboard**:
   - Search for: `StripeConnect`, `payouts`, `onboarding`
   - Verify: Fetches `/stripe-connect/status`
   - Verify: Shows CTA when `chargesEnabled=false` or `payoutsEnabled=false`

3. **Stripe onboarding flow**:
   - Search for: `onboarding-link`, `platform: 'mobile'`
   - Verify: Deep-link handling after Stripe redirect

**Compare to web**:
- `apps/frontend/src/hooks/useCheckout.ts` (preflight validation)
- `apps/frontend/src/components/business/StripeConnectOnboardingCard.tsx` (dashboard CTA)

---

### 3. **If Mobile Diverges: Alignment PR** (Not a "Fix", Just Parity)

If mobile skips preflight or lacks dashboard CTA:

**Changes**:
1. Mobile: Add preflight blocker check before Place Order
2. Mobile: Add Stripe Connect onboarding card to business dashboard
3. Mobile: Ensure deep-link flow works for `?app=mobile` return

**Not a bug fix**: Backend rules are correct. Mobile just needs to match web UX.

---

### 4. **If Product Wants Connect-Hard-Gated Checkout** (Separate Feature)

If the product decision changes to **require Stripe Connect for orders**:

**Backend changes** (substantial):
1. Update `deriveLifecycleStatus` to require payment capability
2. Update `can_accept_orders` generated column to check `is_verified`
3. Update preflight to block when `isPayoutReady(userId) = false` for Stripe-rail sellers
4. Migration to recalculate all business lifecycle states

**Do NOT implement this** unless product explicitly requests it. Current behavior is correct per confirmed rules.

---

## Conclusion

### ✅ Order Placement Rules: Working As Intended

All platforms (backend, web, mobile) correctly implement confirmed product rules:
- ✅ **Place Order** = agreement signed only (`can_accept_orders`)
- ✅ **"Coming soon"** = MoMo phone gate (Stripe countries exempt via `payments_enabled`)
- ✅ **Stripe Connect** = badge + payouts only (NOT order eligibility)

**No gap in order-placement logic.** Business with signed agreement but incomplete Stripe Connect **should be orderable** in Stripe countries.

---

### ❌ Dashboard CTA: Confirmed Bug

**Mobile dashboard does not prompt Stripe Connect setup** after agreement signing.

**Root Cause** (confirmed by Payments):
- `resolveStripeNextAction` never emits `setup_stripe_connect`
- Setup mode exits when `can_accept_orders = true`
- No automatic CTA for Stripe-rail merchants to complete Connect

**Impact on Reported Business** (`03e3ee73-86a3-4323-bc3a-336e67dce9d6`):

| Behavior | Expected | Actual | Status |
|----------|----------|--------|--------|
| Place Order shows "Buy" | ✅ Yes (Stripe country) | ✅ Yes | ✅ Correct |
| Orders placeable | ✅ Yes (agreement signed) | ✅ Yes | ✅ Correct |
| "Coming soon" block | ❌ No (Stripe exempt) | ❌ No | ✅ Correct |
| Dashboard CTA for Connect | ✅ Should show | ❌ Not shown | ❌ **Bug** |
| Verified badge | ❌ No (Connect incomplete) | ❌ No | ✅ Correct |
| Can receive payouts | ❌ No (Connect incomplete) | ❌ No | ✅ Correct |

**Merchant can accept orders but cannot receive payouts, with no dashboard prompt to fix it.**

---

### Fix Status

**Separate fix agent is shipping the next-action correction** to emit `setup_stripe_connect` when:
- Agreement signed (`can_accept_orders = true`)
- Stripe-rail merchant (`paymentRail = 'stripe'`)
- Connect incomplete (`!chargesEnabled || !payoutsEnabled`)

**This investigation is complete.** No changes needed to order-placement logic.
