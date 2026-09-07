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

## Mobile-Specific Concerns (Cannot Verify)

**Mobile app not present in this workspace.** The following must be verified in `mobile-rendasua`:

### 1. **Place Order Button**: Does mobile check preflight blockers?

**Expected**: Mobile PDP/checkout should call `/orders/checkout/preflight` and respect:
- `can_proceed = false` → disable Place Order
- `blocking_errors` containing `MERCHANT_NOT_ACCEPTING_ORDERS` or `LOCATION_PAYMENTS_COMING_SOON`

**Web Implementation** (`apps/frontend/src/hooks/useCheckout.ts:228-234`):

```typescript
const paymentsBlocker = preflight?.blocking_errors?.find(
  (b: { code?: string }) => b.code === 'LOCATION_PAYMENTS_COMING_SOON'
);
const merchantBlocker = preflight?.blocking_errors?.find(
  (b: { code?: string }) => b.code === 'MERCHANT_NOT_ACCEPTING_ORDERS'
);
if (paymentsBlocker || merchantBlocker || preflight?.can_proceed === false) {
  throw Error(...); // Blocks checkout
}
```

**🔍 VERIFY**: Does mobile have equivalent logic, or does it skip preflight validation?

---

### 2. **Business Dashboard CTA**: Stripe onboarding prompt

**Expected**: Mobile business dashboard should:
- Call `/stripe-connect/status` to get `chargesEnabled` / `payoutsEnabled`
- Show "Set up payouts" / "Continue setup" CTA when incomplete
- Link to Stripe Connect onboarding flow

**Web Implementation** (`apps/frontend/src/components/business/StripeConnectOnboardingCard.tsx:77-82`):

```tsx
{!isReady && (
  <Button variant="contained" onClick={startOnboarding}>
    {status?.connected
      ? t('stripe.connect.continueSetup', 'Continue setup')
      : t('stripe.connect.setup', 'Set up payouts')}
  </Button>
)}
```

**🔍 VERIFY**: Does mobile business dashboard surface this CTA, or is it missing/buried?

---

### 3. **Stripe Connect Onboarding Flow**

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

**Web Landing Page** (`apps/frontend/src/components/pages/ConnectOnboardingReturnPage.tsx`):
- Handles `?app=mobile` query param
- Deep-links back to mobile app after Stripe onboarding

**🔍 VERIFY**: Does mobile correctly invoke `/stripe-connect/onboarding-link` with `platform: 'mobile'`?

---

## Summary: Intended vs Actual (Backend)

| Rule | Intended | Backend Implementation | Status |
|------|----------|----------------------|--------|
| Place Order gate | Agreement signed (`can_accept_orders`) | ✅ Checked in preflight | ✅ Correct |
| Payments "Coming soon" | MoMo: phone gate; Stripe: exempt | ✅ `isLocationPaymentsEnabled` | ✅ Correct |
| Stripe Connect for orders | NOT required | ✅ Not checked in preflight | ✅ Correct |
| Stripe Connect for badge | `charges_enabled ∧ payouts_enabled` | ✅ `deriveVerifiedBadge` | ✅ Correct |
| Stripe Connect for payouts | `charges_enabled ∧ payouts_enabled` | ✅ `isPayoutReady` | ✅ Correct |

**✅ Backend implements intended product rules correctly.**

---

## Mobile-Specific Gaps (Hypotheses)

### Hypothesis 1: Mobile Skips Preflight Validation
**Symptom**: Place Order always enabled, ignoring `can_proceed = false`  
**Impact**: Orders placeable even when backend would block  
**Likelihood**: Medium (common mobile shortcut)

### Hypothesis 2: Mobile Dashboard Missing Stripe CTA
**Symptom**: No "Set up payouts" prompt when Connect incomplete  
**Impact**: Merchants don't know to complete Stripe onboarding  
**Likelihood**: High (if dashboard is minimal/different from web)

### Hypothesis 3: Mobile Has Stale/Incorrect can_accept_orders Check
**Symptom**: Mobile checks Stripe Connect instead of lifecycle status  
**Impact**: False negatives (blocks valid orders) or false positives (allows invalid)  
**Likelihood**: Low (would diverge from backend schema)

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

**No backend gap found.** The intended product rules are correctly implemented:
- ✅ Place Order = agreement signed only
- ✅ "Coming soon" = MoMo phone gate (Stripe countries exempt)
- ✅ Stripe Connect = badge + payouts only (not order eligibility)

**Cannot verify mobile app** (not in this workspace). Likely scenarios:
1. **No gap**: Business is in Stripe country → working as intended
2. **Mobile skips preflight**: Place Order enabled without checking backend blockers
3. **Mobile missing dashboard CTA**: No prompt to complete Stripe Connect

**Next steps**:
1. Query prod DB for business country + phone verification status
2. Audit mobile app checkout + dashboard screens
3. If mobile diverges from web, create alignment PR (not a bug fix)
