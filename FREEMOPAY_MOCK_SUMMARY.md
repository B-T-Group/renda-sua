# FreemoPay DEV Mock - Implementation Summary

## Task Complete ✅

Successfully implemented a FreemoPay DEV/flag mock for testing claim top-ups and MoMo flows via API without hitting live FreemoPay.

## What Was Built

### Core Implementation

1. **Configuration Layer** (`apps/backend/src/config/configuration.ts`)
   - Added `FREEMOPAY_AMOUNT_MOCK` environment flag
   - Hard production disable: `amountMockEnabled: FREEMOPAY_AMOUNT_MOCK === 'true' && !isProductionRuntime()`
   - Never enables in production, even if env var is set

2. **FreemopayService Mock** (`apps/backend/src/mobile-payments/providers/freemopay.service.ts`)
   - Mock initiate payment: Skips HTTP, returns pending with `mock-{uuid}` reference
   - Mock withdraw: Same pattern for disbursements
   - Mock status check: Returns SUCCESS/FAILED based on stored amount threshold
   - Amount threshold: < 2000 XAF = SUCCESS, ≥ 2000 XAF = FAILED
   - In-memory outcome storage: `Map<string, {outcome, amount}>`
   - Clear logging with 🔨 prefix for all mock operations

3. **Callback Processor** (`apps/backend/src/mobile-payments/mobile-payment-callback.processor.ts`)
   - Detects mocked transactions by `transaction_id.startsWith('mock-')`
   - Skips live `assertProviderConfirmsCallback` for mocked transactions
   - Applies normal side effects based on callback status

### Testing

**27 passing tests:**
- 20 tests in `freemopay-mock.service.spec.ts`:
  - Mock enabled/disabled behavior
  - Amount threshold logic (< 2000 / = 2000 / > 2000)
  - Payment and withdrawal mocking
  - Status check for mock vs live transactions
  - Mock reference format validation

- 7 tests in `configuration-freemopay-mock.spec.ts`:
  - Production hard disable with NODE_ENV=production
  - Production hard disable with DEPLOYMENT_ENV=production
  - Flag enabled in development
  - Flag disabled behavior
  - Invalid flag values rejected

**Build Status:**
- ✅ Backend builds successfully
- ✅ All tests pass
- ✅ No lint errors introduced

### Documentation

Comprehensive usage guide in `apps/backend/src/mobile-payments/providers/FREEMOPAY_MOCK.md`:
- How to enable/disable the mock
- Testing scenarios for collections and withdrawals
- Callback testing options (admin replay or direct)
- Production safety guarantees
- Troubleshooting guide
- Testing checklist for QA

## Product Rules

**Amount Threshold (Locked):**
- Amounts **< 2000 XAF** → simulate **SUCCESS**
- Amounts **≥ 2000 XAF** → simulate **FAILED**
- Threshold is inclusive (2000 XAF fails)

**Applies to:**
- Collections (payments, claim_order top-ups, wallet deposits)
- Withdrawals (give-change, merchant payouts)
- All FreemoPay flows

## Hard Safety Guarantees

**Production can NEVER enable the mock:**

1. **Environment flag required**: `FREEMOPAY_AMOUNT_MOCK=true` must be explicitly set
2. **Runtime check**: Configuration uses `isProductionRuntime()` to refuse enabling if:
   - `NODE_ENV === 'production'`, OR
   - `DEPLOYMENT_ENV === 'production'`
3. **No HTTP calls when mock enabled**: All FreemoPay API calls are skipped
4. **Clear logging**: All mock operations log with 🔨 prefix
5. **Tested**: 7 unit tests verify production hard disable

Even if someone sets `FREEMOPAY_AMOUNT_MOCK=true` in production secrets, the runtime check blocks it.

## How to Use (DEV Only)

### Enable Mock

Add to DEV secrets:
```bash
FREEMOPAY_AMOUNT_MOCK=true
```

Restart backend. Look for warning in logs:
```
⚠️  FreemoPay DEV MOCK ENABLED: amounts < 2000 XAF will simulate SUCCESS, >= 2000 XAF will simulate FAILED. NO LIVE API CALLS.
```

### Test Claim Order Top-Up (SUCCESS)

```bash
# 1. Initiate payment < 2000 XAF
POST /mobile-payments/initiate
{
  "amount": 1500,
  "currency": "XAF",
  "customerPhone": "237600000000",
  "paymentEntity": "claim_order",
  "accountId": "<account-id>"
}

# 2. Returns mock-{uuid} reference, status=pending

# 3. Trigger callback (admin replay)
POST /admin/mobile-payments/replay-callback
{
  "transactionId": "<mobile-payment-tx-id>",
  "status": "SUCCESS"
}

# 4. Verify:
# - Wallet credited
# - Order marked paid
# - Order proceeds to fulfillment
```

### Test Claim Order Top-Up (FAILED)

```bash
# 1. Initiate payment >= 2000 XAF
POST /mobile-payments/initiate
{
  "amount": 2500,
  "currency": "XAF",
  "customerPhone": "237600000000",
  "paymentEntity": "claim_order",
  "accountId": "<account-id>"
}

# 2. Returns mock-{uuid} reference

# 3. Trigger FAILED callback
POST /admin/mobile-payments/replay-callback
{
  "transactionId": "<mobile-payment-tx-id>",
  "status": "FAILED"
}

# 4. Verify:
# - Wallet NOT credited
# - Order remains unpaid or cancelled
# - Failure side effects applied
```

### Test Merchant Payout

Same pattern for withdrawals:
- < 2000 XAF → SUCCESS (hold released, wallet debited)
- ≥ 2000 XAF → FAILED (hold released, wallet NOT debited)

### Disable Mock

Remove env var or set to false:
```bash
FREEMOPAY_AMOUNT_MOCK=false
# or remove entirely
```

Restart backend. All requests use live FreemoPay API.

## Pull Request

**PR #489**: https://github.com/B-T-Group/renda-sua/pull/489
- Branch: `cursor/freemopay-dev-mock-d211`
- Target: `main` (not prod)
- Status: Draft, ready for review
- CI: Backend tests pass, build succeeds

## Files Changed

### Core Implementation (3 files)
- `apps/backend/src/config/configuration.ts`
- `apps/backend/src/mobile-payments/providers/freemopay.service.ts`
- `apps/backend/src/mobile-payments/mobile-payment-callback.processor.ts`

### Tests (2 files)
- `apps/backend/src/mobile-payments/providers/freemopay-mock.service.spec.ts`
- `apps/backend/src/config/configuration-freemopay-mock.spec.ts`

### Documentation (1 file)
- `apps/backend/src/mobile-payments/providers/FREEMOPAY_MOCK.md`

## Commits

1. `e0d154e2` - feat: add FreemoPay DEV amount mock for testing
2. `c70edbc1` - feat: add mock callback helper and comprehensive docs

## Next Steps for QA (#450)

1. Merge PR to main (not prod)
2. Deploy to DEV
3. Enable mock via DEV secrets: `FREEMOPAY_AMOUNT_MOCK=true`
4. Test claim order top-ups:
   - SUCCESS: amount < 2000 XAF
   - FAILED: amount ≥ 2000 XAF
5. Test merchant payouts:
   - SUCCESS: amount < 2000 XAF
   - FAILED: amount ≥ 2000 XAF
6. Verify wallet credits/debits
7. Verify order state transitions
8. Disable mock when live testing needed

## Why This Matters

Before this change:
- DEV FreemoPay was LIVE (real money)
- Testing claim top-ups risked real money movement
- Callbacks required live provider confirmation
- #450 API testing was blocked

After this change:
- DEV can safely test without live FreemoPay
- Amount threshold controls success/failure
- No real money moves when mock enabled
- #450 API testing unblocked

## Production Safety Summary

✅ Environment flag required
✅ Hard runtime check (NODE_ENV/DEPLOYMENT_ENV)
✅ No HTTP calls when mock enabled
✅ Clear logging for QA visibility
✅ Comprehensive tests for production disable
✅ No env samples set flag to true
✅ No Hasura toggle (can't be flipped by accident)
✅ Behavior identical to today when mock off

**Production can NEVER enable the mock.**

---

Task completed successfully. All acceptance criteria met.
