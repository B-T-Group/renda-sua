# FreemoPay DEV Amount Mock

## Overview

This mock allows safe testing of FreemoPay payment and withdrawal flows in DEV without hitting the live FreemoPay API. Real money never moves when the mock is enabled.

## Product Rules

When the mock is **enabled**:

- **Amounts < 2000 XAF** → simulate **SUCCESS** (same side effects as real FreemoPay success)
- **Amounts ≥ 2000 XAF** → simulate **FAILED** (same failure side effects as real FreemoPay failure)

The threshold is **inclusive** (2000 XAF fails).

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

# Trigger callback manually (see below)
# Or wait for status check to return SUCCESS
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
# Status check will return FAILED
# Callback with FAILED status will trigger failure side effects
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
# Trigger SUCCESS callback to complete
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
# Trigger FAILED callback to complete (releases hold, no debit)
```

## Callback Testing

### Option 1: Manual Callback (Recommended)

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

### Option 2: Direct Callback Endpoint

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
4. Trigger SUCCESS callback (manual or admin replay)
5. Verify:
   - Wallet credited
   - Order marked as paid
   - Order proceeds to fulfillment

### Claim Order Top-Up (≥ 2000 XAF)

1. Create a claim order
2. Initiate payment with amount 2500 XAF
3. Mock returns pending with `mock-*` reference
4. Trigger FAILED callback
5. Verify:
   - Wallet NOT credited
   - Order remains unpaid or cancelled
   - Failure side effects applied

### Merchant Payout (< 2000 XAF)

1. Initiate give-change withdrawal with amount 1800 XAF
2. Mock places hold on wallet, returns pending
3. Trigger SUCCESS callback
4. Verify:
   - Hold released
   - Wallet debited
   - Transaction marked success

### Merchant Payout (≥ 2000 XAF)

1. Initiate give-change withdrawal with amount 2200 XAF
2. Mock places hold on wallet, returns pending
3. Trigger FAILED callback
4. Verify:
   - Hold released
   - Wallet NOT debited
   - Transaction marked failed

## Implementation Details

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

### Status check returns PENDING for mock transaction

The mock reference may not be in memory:
- Backend was restarted after initiating the transaction
- Transaction was created by a different backend instance
- Reference is incorrect

Solution: Re-initiate the transaction or trigger a callback manually.

### Callbacks not working

Make sure you're using the correct callback endpoint and format:
- Admin replay: POST `/admin/mobile-payments/replay-callback`
- Direct callback: POST `/mobile-payments/callback/freemopay`

For mocked transactions, the provider confirmation is automatically skipped.

## Testing Checklist

- [ ] Enable mock in DEV (env var + restart)
- [ ] Verify mock warning in logs
- [ ] Test payment < 2000 XAF → SUCCESS
- [ ] Test payment = 2000 XAF → FAILED
- [ ] Test payment > 2000 XAF → FAILED
- [ ] Test withdrawal < 2000 XAF → SUCCESS
- [ ] Test withdrawal ≥ 2000 XAF → FAILED
- [ ] Verify no live HTTP calls in logs (no real FreemoPay API requests)
- [ ] Test callback processing (admin replay or direct)
- [ ] Verify wallet credits/debits
- [ ] Verify order state transitions
- [ ] Test claim order flow end-to-end
- [ ] Disable mock, verify live API resumes
