# FreemoPay DEV Amount Mock

## Overview

This mock allows safe testing of FreemoPay payment and withdrawal flows in DEV without hitting the live FreemoPay API. Real money never moves when the mock is enabled.

**Auto-Callback**: Mock transactions automatically trigger callbacks after ~1.5 seconds, eliminating the need for manual admin replay during testing.

## Product Rules

When the mock is **enabled**:

- **Amounts < 2000 XAF** → simulate **SUCCESS** (auto-callback with SUCCESS status after ~1.5s)
- **Amounts ≥ 2000 XAF** → simulate **FAILED** (auto-callback with FAILED status after ~1.5s)

The threshold is **inclusive** (2000 XAF fails).

**Auto-callbacks** go through the real payment callback processor, applying the same side effects as live FreemoPay callbacks (wallet credits/debits, order state transitions, etc.).

## Safety

### Hard Production Disable

The mock can **NEVER** be enabled in production. Two layers of protection:

1. **Environment flag**: `FREEMOPAY_AMOUNT_MOCK=true` must be set
2. **Runtime check**: Configuration refuses to enable if `NODE_ENV=production` or `DEPLOYMENT_ENV=production`

Even if someone sets `FREEMOPAY_AMOUNT_MOCK=true` in production, it will be ignored.

### Logs

All mocked transactions log clearly with 🔨 prefix:

```
🔨 MOCK FreemoPay payment: amount=1000 XAF, payer=237600000000, reference=test-ref, mock_ref=mock-abc-123, outcome=SUCCESS
```

## Enabling the Mock

### DEV Environment

Add to your DEV secrets (never commit to git):

```bash
FREEMOPAY_AMOUNT_MOCK=true
```

The mock will only work when:
- `FREEMOPAY_AMOUNT_MOCK=true` is set
- `NODE_ENV` is NOT `production`
- `DEPLOYMENT_ENV` is NOT `production`

### Local Development

Add to your `.env.local` (not tracked by git):

```bash
FREEMOPAY_AMOUNT_MOCK=true
NODE_ENV=development
```

Restart the backend after changing the environment variable.

## Usage

### Testing Collections (Payments)

**SUCCESS scenario (< 2000 XAF):**

```bash
# Initiate a wallet top-up or claim order payment
POST /mobile-payments/initiate
{
  "amount": 1500,
  "currency": "XAF",
  "customerPhone": "237600000000",
  "description": "Test payment",
  "accountId": "some-account-id",
  "transactionType": "PAYMENT",
  "paymentEntity": "claim_order"
}

# Response includes mock reference:
{
  "success": true,
  "transactionId": "mock-abc-123-...",
  "reference": "mock-abc-123-..."
}

# ✅ AUTO-CALLBACK: After ~1.5 seconds, SUCCESS callback is automatically triggered
# Verify side effects:
# - Wallet credited
# - Order marked paid
# - Order proceeds to fulfillment
```

**FAILED scenario (≥ 2000 XAF):**

```bash
# Use amount >= 2000
POST /mobile-payments/initiate
{
  "amount": 2500,
  "currency": "XAF",
  "customerPhone": "237600000000",
  "description": "Test failed payment",
  "accountId": "some-account-id"
}

# Reference will be mock-xyz-456-...
# ✅ AUTO-CALLBACK: After ~1.5 seconds, FAILED callback is automatically triggered
# Verify side effects:
# - Wallet NOT credited
# - Order remains unpaid or cancelled
# - Failure side effects applied
```

### Testing Withdrawals (Give Change)

**SUCCESS scenario (< 2000 XAF):**

```bash
POST /give-change/payout
{
  "amount": 1800,
  "currency": "XAF",
  "customerPhone": "237600000000",
  "description": "Test withdrawal",
  "accountId": "some-account-id"
}

# Returns mock reference
# ✅ AUTO-CALLBACK: After ~1.5 seconds, SUCCESS callback is automatically triggered
# Verify:
# - Hold released
# - Wallet debited
# - Transaction marked success
```

**FAILED scenario (≥ 2000 XAF):**

```bash
POST /give-change/payout
{
  "amount": 3000,
  "currency": "XAF",
  "customerPhone": "237600000000",
  "description": "Test failed withdrawal",
  "accountId": "some-account-id"
}

# Returns mock reference
# ✅ AUTO-CALLBACK: After ~1.5 seconds, FAILED callback is automatically triggered
# Verify:
# - Hold released
# - Wallet NOT debited
# - Transaction marked failed
```

## Callback Testing

### Auto-Callbacks (Default)

**Mock transactions automatically trigger callbacks after ~1.5 seconds.** No manual intervention needed for normal testing.

After initiating a mock payment or withdrawal:
1. Transaction is created with `mock-{uuid}` reference and `pending` status
2. After ~1.5 seconds, callback is automatically triggered
3. Callback processor applies side effects (wallet credits/debits, order updates, etc.)
4. Transaction status becomes `success` or `failed` based on amount threshold

**This is the recommended flow for testing #450 claim top-ups and merchant payouts.**

### Manual Callbacks (Optional)

If you need to test specific callback scenarios or timing, you can still trigger callbacks manually:

#### Option 1: Admin Callback Replay

Use the existing admin callback replay endpoint:

```bash
# For SUCCESS (amount < 2000)
POST /admin/mobile-payments/replay-callback
Authorization: Bearer <admin-token>
{
  "transactionId": "<mobile-payment-transaction-id>",
  "status": "SUCCESS"
}

# For FAILED (amount >= 2000)
POST /admin/mobile-payments/replay-callback
Authorization: Bearer <admin-token>
{
  "transactionId": "<mobile-payment-transaction-id>",
  "status": "FAILED"
}
```

The replay endpoint will:
1. Look up the transaction
2. Call the callback processor with the specified status
3. Apply all side effects (wallet credits/debits, order updates, etc.)

For mocked transactions, the live provider confirmation is automatically skipped.

#### Option 2: Direct Callback Endpoint

If you have the mock reference (starts with `mock-`), you can call the callback endpoint directly:

```bash
POST /mobile-payments/callback/freemopay
Content-Type: application/json

{
  "reference": "mock-abc-123-...",
  "status": "SUCCESS",
  "merchantRef": "your-external-ref",
  "externalId": "your-external-ref"
}
```

The callback processor will:
1. Look up the transaction by mock reference
2. Skip live provider confirmation (mocked transaction)
3. Apply side effects based on the status

## Status Checks

Mock transactions return their predetermined status when checked:

```bash
GET /mobile-payments/status/{mockReference}

# For amount < 2000:
{
  "status": "SUCCESS",
  "amount": 1500,
  "reference": "mock-abc-123-...",
  "message": "Mock transaction succeeded"
}

# For amount >= 2000:
{
  "status": "FAILED",
  "amount": 2500,
  "reference": "mock-xyz-456-...",
  "reason": "Mock failure (amount >= threshold)"
}
```

## Testing Scenarios for #450

### Claim Order Top-Up (< 2000 XAF)

1. Create a claim order
2. Initiate payment with amount 1500 XAF
3. Mock returns pending with `mock-*` reference
4. ✅ **Auto-callback triggers after ~1.5s with SUCCESS**
5. Verify:
   - Wallet credited
   - Order marked as paid
   - Order proceeds to fulfillment

### Claim Order Top-Up (≥ 2000 XAF)

1. Create a claim order
2. Initiate payment with amount 2500 XAF
3. Mock returns pending with `mock-*` reference
4. ✅ **Auto-callback triggers after ~1.5s with FAILED**
5. Verify:
   - Wallet NOT credited
   - Order remains unpaid or cancelled
   - Failure side effects applied

### Merchant Payout (< 2000 XAF)

1. Initiate give-change withdrawal with amount 1800 XAF
2. Mock places hold on wallet, returns pending
3. ✅ **Auto-callback triggers after ~1.5s with SUCCESS**
4. Verify:
   - Hold released
   - Wallet debited
   - Transaction marked success

### Merchant Payout (≥ 2000 XAF)

1. Initiate give-change withdrawal with amount 2200 XAF
2. Mock places hold on wallet, returns pending
3. ✅ **Auto-callback triggers after ~1.5s with FAILED**
4. Verify:
   - Hold released
   - Wallet NOT debited
   - Transaction marked failed

## Implementation Details

### Auto-Callback Mechanism

Mock transactions automatically trigger callbacks after a ~1.5 second delay:

1. After mock initiate/withdraw, `scheduleAutoCallback()` is called
2. Uses `setTimeout()` to schedule async callback processing
3. Callback goes through real `MobilePaymentCallbackProcessor.processFreemopayCallback()`
4. Same side effects as live FreemoPay callbacks (wallet ops, order updates, etc.)

**Delay**: 1500ms (1.5 seconds) by default. Enough time for the initiate response to be returned and logged, but fast enough for efficient testing.

### Mock Transaction References

All mock transactions use UUIDs with `mock-` prefix:

```
mock-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Status Check Behavior

- Mock transactions (starts with `mock-`): return stored outcome from memory
- Non-mock transactions: call live FreemoPay API
- Unknown mock references: return PENDING

### Callback Processing

The callback processor automatically detects mocked transactions:

```typescript
if (tx.transaction_id?.startsWith('mock-')) {
  // Skip live provider confirmation
  this.logger.log('Skipping live provider confirmation for mocked transaction');
}
```

### Memory Storage

Mock outcomes are stored in memory (per-process):

```typescript
private readonly mockOutcomes = new Map<string, { outcome: 'SUCCESS' | 'FAILED'; amount: number }>();
```

This means:
- Outcomes persist for the life of the backend process
- Restarting the backend clears mock outcomes
- Each backend instance has its own store (not shared)

## Disabling the Mock

Remove or set to false in your environment:

```bash
FREEMOPAY_AMOUNT_MOCK=false
# or just remove the variable
```

Restart the backend. All subsequent requests will use the live FreemoPay API.

## Production

The mock is **NEVER** enabled in production, even if someone accidentally sets `FREEMOPAY_AMOUNT_MOCK=true`.

The configuration loader includes a hard check:

```typescript
amountMockEnabled:
  process.env.FREEMOPAY_AMOUNT_MOCK === 'true' &&
  !isProductionRuntime(process.env),
```

## Troubleshooting

### Mock not working (still hitting live API)

Check:
1. `FREEMOPAY_AMOUNT_MOCK=true` is set in your environment
2. `NODE_ENV` is NOT `production`
3. Backend has been restarted after changing env vars
4. Look for the mock warning in logs at startup:

```
⚠️  FreemoPay DEV MOCK ENABLED: amounts < 2000 XAF will simulate SUCCESS, >= 2000 XAF will simulate FAILED. NO LIVE API CALLS.
```

### Auto-callbacks not working

Check:
1. Mock is enabled (see warning in logs)
2. Wait at least 1.5 seconds after initiating payment/withdrawal
3. Look for auto-callback logs:

```
🔨 AUTO-CALLBACK triggered for mock-abc-123: SUCCESS (delay=1500ms)
```

If auto-callbacks are not triggering:
- Backend may have been restarted (setTimeout is in-memory)
- Callback processor may not be available (check logs for warnings)
- Test with manual callback replay as fallback

### Status check returns PENDING for mock transaction

The mock reference may not be in memory:
- Backend was restarted after initiating the transaction
- Transaction was created by a different backend instance
- Reference is incorrect

Solution: Re-initiate the transaction or wait for auto-callback to complete.

### Callbacks not applying side effects

For mocked transactions, the provider confirmation is automatically skipped. Side effects should apply normally. Check:
1. Transaction exists in `mobile_payment_transactions` table
2. Transaction status is `pending` before callback
3. Callback logs show processing completed
4. Account/order records are being queried correctly

## Testing Checklist

- [ ] Enable mock in DEV (env var + restart)
- [ ] Verify mock warning in logs
- [ ] Test payment < 2000 XAF → SUCCESS (auto-callback)
- [ ] Test payment = 2000 XAF → FAILED (auto-callback)
- [ ] Test payment > 2000 XAF → FAILED (auto-callback)
- [ ] Test withdrawal < 2000 XAF → SUCCESS (auto-callback)
- [ ] Test withdrawal ≥ 2000 XAF → FAILED (auto-callback)
- [ ] Verify auto-callback logs (🔨 AUTO-CALLBACK triggered)
- [ ] Verify no live HTTP calls in logs (no real FreemoPay API requests)
- [ ] Verify wallet credits/debits after auto-callback
- [ ] Verify order state transitions after auto-callback
- [ ] Test claim order flow end-to-end with auto-callback
- [ ] Wait at least 2 seconds between initiate and verification
- [ ] Disable mock, verify live API resumes
