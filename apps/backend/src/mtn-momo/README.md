# MTN MoMo Integration

> **Status:** MTN MoMo is the planned future replacement for Freemopay for Cameroon mobile
> payments. It runs against the sandbox on DEV, but it is intentionally **not connected to
> orders yet**: that waits for production credentials. Freemopay remains the live provider until then.

This module provides comprehensive integration with MTN Mobile Money (MoMo) API for collection, disbursement, and remittance operations.

## Features

- **Collection (Request to Pay)**: Request payments from customers
- **Disbursement (Transfer)**: Send money to customers
- **Remittance**: International money transfers
- **Account Balance**: Check account balances
- **Account Validation**: Validate account holders
- **Webhook Handling**: Process MTN MoMo callbacks
- **Health Checks**: Service health monitoring

## Environment Variables

MTN issues a **separate subscription key, API user id and API key per product**
(Collection, Disbursement, Remittance). Configure each product on its own:

```env
MTN_MOMO_TARGET_ENVIRONMENT=sandbox   # value sent in X-Target-Environment
MTN_MOMO_BASE_URL=                    # optional; see "Base URL and target environment"
MTN_MOMO_CURRENCY=                    # optional; default EUR on sandbox, XAF otherwise
MTN_MOMO_CALLBACK_URL=https://rendasua.com/dev/api/mtn-momo/webhook   # optional
MTN_MOMO_WEBHOOK_SECRET=              # required for callbacks (signs the per-request token)

MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY=
MTN_MOMO_COLLECTION_API_USER_ID=
MTN_MOMO_COLLECTION_API_KEY=
MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=
MTN_MOMO_DISBURSEMENT_API_USER_ID=
MTN_MOMO_DISBURSEMENT_API_KEY=
MTN_MOMO_REMITTANCE_SUBSCRIPTION_KEY=
MTN_MOMO_REMITTANCE_API_USER_ID=
MTN_MOMO_REMITTANCE_API_KEY=
```

Backward-compatible fallbacks (collection only): `MTN_MOMO_COLLECTION_PRIMARY_KEY`,
`MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER_ID`, `MTN_MOMO_API_KEY`. Disbursement and
remittance never fall back to the single legacy credential set (MTN answers 401 on the token
call). A product with missing variables fails with an error naming the variables, never their
values. In DEV/PROD these are loaded from AWS Secrets Manager
(`development-rendasua-backend-secrets` / `production-rendasua-backend-secrets`, ca-central-1).

### Base URL and target environment

They are independent: `MTN_MOMO_TARGET_ENVIRONMENT` is only the `X-Target-Environment`
header; `MTN_MOMO_BASE_URL` is the host. Defaults: `sandbox` -> `https://sandbox.momodeveloper.mtn.com`,
`production` -> `https://proxy.momoapi.mtn.com` (legacy). Any other target environment has no
default host and fails fast until `MTN_MOMO_BASE_URL` is set.

> **UNCONFIRMED:** MTN Cameroon reportedly uses target environment `mtncameroon` with base URL
> `https://momoapi.momo.africa`. Pending written confirmation from MTN
> (MoMoCorporate.CM@mtn.com); nothing is assumed, set both values explicitly once confirmed.

### Currency

`MTN_MOMO_CURRENCY` is the default when a request has no `currency`. The sandbox accepts EUR
only; production Cameroon uses XAF, which has no decimals (fractional XAF/XOF amounts are
rejected, integers are sent unpadded).

### Callbacks (webhook)

- `X-Callback-Url` is sent only when `MTN_MOMO_CALLBACK_URL` **and** `MTN_MOMO_WEBHOOK_SECRET`
  are set (MTN answers 500 for an empty header). The URL gets `?ref=<referenceId>&token=<hmac>`
  appended; the token is an HMAC-SHA256 of the reference id, verified in constant time, and a
  mismatch gets 401 (the token is never logged). MTN callbacks carry no reference id and are not
  retried, so `ref` travels in the URL.
- **Callback host:** MTN validates the callback host against the API user's
  `providerCallbackHost`. The sandbox API user is registered for `rendasua.com`, so the callback
  must be `https://rendasua.com/...`. `https://api.rendasua.com/...` is rejected by the sandbox
  with `INVALID_CALLBACK_URL_HOST` (HTTP 500). To use api.rendasua.com, re-register the API user.
- A callback is only a trigger: the status is re-read from MTN with a GET before the payment
  request is updated (guarded `PENDING` -> terminal update, idempotent).
- `MtnMomoReconcilerService` polls `PENDING` payment requests every 5 minutes as the fallback.
- Disbursement/remittance transfers are not stored in the DB, so they are not reconciled;
  poll them via the transfer-status endpoint.

## API Endpoints

### Collection (Request to Pay)

#### Request Payment

```http
POST /api/mtn-momo/collection/request-to-pay
```

**Request Body:**

```json
{
  "amount": "100",
  "currency": "EUR",
  "externalId": "unique_transaction_id",
  "payer": {
    "partyIdType": "MSISDN",
    "partyId": "46733123454"
  },
  "payerMessage": "Payment for order #123",
  "payeeNote": "Thank you for your purchase"
}
```

#### Check Payment Status

```http
GET /api/mtn-momo/collection/status/{referenceId}
```

### Disbursement (Transfer)

#### Send Money

```http
POST /api/mtn-momo/disbursement/transfer
```

**Request Body:**

```json
{
  "amount": "100",
  "currency": "EUR",
  "externalId": "unique_transaction_id",
  "payee": {
    "partyIdType": "MSISDN",
    "partyId": "46733123454"
  },
  "payerMessage": "Refund for order #123",
  "payeeNote": "Your refund has been processed"
}
```

#### Check Transfer Status

```http
GET /api/mtn-momo/disbursement/status/{referenceId}
```

### Remittance

#### International Transfer

```http
POST /api/mtn-momo/remittance/transfer
```

**Request Body:**

```json
{
  "amount": "100",
  "currency": "EUR",
  "externalId": "unique_transaction_id",
  "payee": {
    "partyIdType": "MSISDN",
    "partyId": "46733123454"
  },
  "payerMessage": "International transfer",
  "payeeNote": "Money received"
}
```

### Account Management

#### Get Account Balance

```http
GET /api/mtn-momo/balance?type=collection
```

**Query Parameters:**

- `type`: `collection`, `disbursement`, or `remittance` (default: `collection`)

#### Validate Account Holder

```http
GET /api/mtn-momo/validate-account?partyId=46733123454&partyIdType=MSISDN&type=collection
```

**Query Parameters:**

- `partyId`: The account identifier
- `partyIdType`: `MSISDN`, `EMAIL`, or `PARTY_CODE`
- `type`: `collection`, `disbursement`, or `remittance` (default: `collection`)

### Webhook

#### Handle MTN MoMo Callbacks

```http
POST /api/mtn-momo/webhook
```

This endpoint receives callbacks from MTN MoMo when transaction status changes.

### Health Check

#### Service Health

```http
GET /api/mtn-momo/health
```

## Usage Examples

### Request Payment from Customer

```typescript
import { MtnMomoService } from './mtn-momo.service';

// In your service
const result = await this.mtnMomoService.requestToPay({
  amount: '100',
  currency: 'EUR',
  externalId: 'order_123',
  payer: {
    partyIdType: 'MSISDN',
    partyId: '46733123454',
  },
  payerMessage: 'Payment for order #123',
  payeeNote: 'Thank you for your purchase',
});

if (result.status) {
  console.log(`Payment requested: ${result.financialTransactionId}`);
} else {
  console.error(`Payment failed: ${result.error}`);
}
```

### Send Money to Customer

```typescript
const result = await this.mtnMomoService.transfer({
  amount: '50',
  currency: 'EUR',
  externalId: 'refund_123',
  payee: {
    partyIdType: 'MSISDN',
    partyId: '46733123454',
  },
  payerMessage: 'Refund for order #123',
  payeeNote: 'Your refund has been processed',
});
```

### Check Transaction Status

```typescript
const status = await this.mtnMomoService.requestToPayDeliveryNotification(referenceId);
if (status.status) {
  console.log(`Transaction successful: ${status.financialTransactionId}`);
} else {
  console.log(`Transaction failed: ${status.statusMessage}`);
}
```

## Error Handling

The service returns structured responses with error information:

```typescript
interface MtnMomoResponse {
  status: boolean;
  financialTransactionId?: string;
  externalId?: string;
  amount?: string;
  currency?: string;
  statusCode?: string;
  statusMessage?: string;
  error?: string;
}
```

## Security Considerations

1. **Environment Variables**: Store all sensitive keys in environment variables
2. **HTTPS**: Always use HTTPS in production
3. **Webhook Validation**: Per-request HMAC token in the callback URL (see Callbacks) plus a status re-check against MTN
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Logging**: Log all transactions for audit purposes
6. **Admin-only HTTP money routes**: Collection, disbursement, remittance, balance,
   account validation, payment-request reads, and health require a JWT plus
   `platform.financial.mobile_payments` (or superuser). Any authenticated user
   used to be able to call `POST /disbursement/transfer` and
   `POST /remittance/transfer` when product credentials were set. The webhook
   stays `@Public()` and is gated only by the HMAC token. Order checkout still
   goes through `MobilePaymentsService`, not these routes.

## Testing

### Sandbox Environment

For testing, use the sandbox environment:

- Set `MTN_MOMO_TARGET_ENVIRONMENT=sandbox`
- Use sandbox API keys and credentials
- Test with sandbox phone numbers

### Sandbox end-to-end test (opt-in)

`mtn-momo.sandbox.real.spec.ts` calls the real sandbox and is skipped unless
`MTN_MOMO_SANDBOX_E2E=true`, so CI never hits the network. Provide the per-product variables
above (and `MTN_MOMO_CALLBACK_URL` on host rendasua.com, `MTN_MOMO_WEBHOOK_SECRET`), then:

```bash
MTN_MOMO_SANDBOX_E2E=true npx nx test backend --testPathPattern=mtn-momo.sandbox
```

Sandbox numbers: `56733123453` success, `46733123451` rejected, `46733123452` expired,
`46733123453` pending. The sandbox balance endpoint intermittently answers 500/503; the test retries it.

### Production Environment

For production:

- Set `MTN_MOMO_TARGET_ENVIRONMENT` and `MTN_MOMO_BASE_URL` (see above; the Cameroon values are unconfirmed)
- Set `MTN_MOMO_CURRENCY=XAF`
- Use production API keys and credentials for each product
- Ensure proper SSL certificates
- Implement comprehensive error handling

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Check API keys and subscription key
2. **Invalid Party ID**: Ensure phone numbers are in correct format (e.g., 46733123454)
3. **Currency Issues**: Use supported currencies (EUR, USD, etc.)
4. **Webhook Failures**: Check callback URL accessibility

### Debug Mode

Enable debug logging by setting the log level to debug in your NestJS configuration.

## Support

For MTN MoMo API support, refer to the official documentation:

- [MTN MoMo API Documentation](https://momodeveloper.mtn.com/)
- [API Reference](https://momodeveloper.mtn.com/docs/services/collection/)
