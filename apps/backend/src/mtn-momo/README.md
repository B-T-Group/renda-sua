# MTN MoMo Integration

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

Add the following environment variables to your `.env` file:

```env
# MTN MoMo Configuration
MTN_MOMO_SUBSCRIPTION_KEY=your_subscription_key
MTN_MOMO_API_KEY=your_api_key
MTN_MOMO_API_USER_ID=your_api_user_id
MTN_MOMO_TARGET_ENVIRONMENT=sandbox
MTN_MOMO_COLLECTION_PRIMARY_KEY=your_collection_primary_key
MTN_MOMO_COLLECTION_SECONDARY_KEY=your_collection_secondary_key
MTN_MOMO_DISBURSEMENT_PRIMARY_KEY=your_disbursement_primary_key
MTN_MOMO_DISBURSEMENT_SECONDARY_KEY=your_disbursement_secondary_key
MTN_MOMO_REMITTANCE_PRIMARY_KEY=your_remittance_primary_key
MTN_MOMO_REMITTANCE_SECONDARY_KEY=your_remittance_secondary_key
MTN_MOMO_CALLBACK_URL=https://your-domain.com/api/mtn-momo/webhook
```

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
3. **Webhook Validation**: Implement webhook signature validation
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Logging**: Log all transactions for audit purposes

## Testing

### Sandbox Environment

For testing, use the sandbox environment:

- Set `MTN_MOMO_TARGET_ENVIRONMENT=sandbox`
- Use sandbox API keys and credentials
- Test with sandbox phone numbers

### Production Environment

For production:

- Set `MTN_MOMO_TARGET_ENVIRONMENT=production`
- Use production API keys and credentials
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
