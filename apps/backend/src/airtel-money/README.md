# Airtel Money Integration

This module provides integration with the [Airtel Money API](https://developers.airtel.africa/documentation/collection-apis/2.0) for payment processing in the Rendasua application.

## Features

- **Payment Requests**: Request payments from customers via Airtel Money
- **Transaction Status**: Check the status of payment transactions
- **Refunds**: Process refunds for completed transactions
- **Account Balance**: Retrieve account balance information
- **Webhook Callbacks**: Handle payment status updates via webhooks
- **Database Logging**: Track all payment transactions in the database

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Airtel Money Configuration
AIRTEL_MONEY_CLIENT_ID=your_client_id
AIRTEL_MONEY_CLIENT_SECRET=your_client_secret
AIRTEL_MONEY_TARGET_ENVIRONMENT=sandbox  # or 'production'
AIRTEL_MONEY_CALLBACK_URL=https://your-domain.com/api/airtel-money/callback
AIRTEL_MONEY_COUNTRY=UG  # Default: UG
AIRTEL_MONEY_CURRENCY=UGX  # Default: UGX
```

### Getting Credentials

1. Register for an Airtel Money developer account at [developers.airtel.africa](https://developers.airtel.africa)
2. Create a new application in the developer portal
3. Obtain your `client_id` and `client_secret`
4. Configure your callback URL in the developer portal

## API Endpoints

### Request Payment

```http
POST /api/airtel-money/request-payment
Content-Type: application/json

{
  "reference": "PAY_123456789",
  "subscriber": {
    "country": "UG",
    "currency": "UGX",
    "msisdn": "256700000000"
  },
  "transaction": {
    "amount": "1000",
    "country": "UG",
    "currency": "UGX",
    "id": "TXN_123456789"
  }
}
```

### Get Transaction Status

```http
GET /api/airtel-money/transaction/{transactionId}/status
```

### Refund Transaction

```http
POST /api/airtel-money/refund/{transactionId}
Content-Type: application/json

{
  "amount": "1000",
  "reason": "Customer request"
}
```

### Get Account Balance

```http
GET /api/airtel-money/balance
```

### Webhook Callback

```http
POST /api/airtel-money/callback
Content-Type: application/json

{
  "transaction": {
    "id": "transaction_id",
    "status": "SUCCESSFUL"
  }
}
```

## Database Schema

The integration creates an `airtel_money_payments` table with the following structure:

```sql
CREATE TABLE public.airtel_money_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_id text NOT NULL UNIQUE,
    reference text NOT NULL,
    amount text NOT NULL,
    currency text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING',
    message text,
    notes text,
    callback_data jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

## Frontend Integration

### React Hook

Use the `useAirtelMoney` hook in your React components:

```typescript
import { useAirtelMoney } from '../hooks/useAirtelMoney';

const MyComponent = () => {
  const { requestPayment, getTransactionStatus, loading, error } = useAirtelMoney();

  const handlePayment = async () => {
    const result = await requestPayment({
      reference: 'PAY_123',
      subscriber: {
        country: 'UG',
        currency: 'UGX',
        msisdn: '256700000000',
      },
      transaction: {
        amount: '1000',
        country: 'UG',
        currency: 'UGX',
        id: 'TXN_123',
      },
    });

    if (result.status) {
      console.log('Payment initiated:', result.transactionId);
    }
  };

  return (
    <button onClick={handlePayment} disabled={loading}>
      {loading ? 'Processing...' : 'Pay with Airtel Money'}
    </button>
  );
};
```

### Example Component

See `AirtelMoneyExample.tsx` for a complete example of all available features.

## Error Handling

The service includes comprehensive error handling:

- **API Errors**: Network errors, authentication failures, and API-specific errors
- **Validation Errors**: Invalid request parameters
- **Database Errors**: Transaction logging failures
- **Webhook Errors**: Callback processing failures

All errors are logged with Winston and include context for debugging.

## Security Considerations

1. **Authentication**: Uses OAuth2 client credentials flow
2. **Token Management**: Automatic token refresh with 50-minute expiry
3. **Input Validation**: All inputs are validated before processing
4. **Database Security**: Uses parameterized queries to prevent SQL injection
5. **Webhook Security**: Validate webhook signatures (implement as needed)

## Testing

### Sandbox Environment

For testing, use the sandbox environment:

```bash
AIRTEL_MONEY_TARGET_ENVIRONMENT=sandbox
```

### Test Phone Numbers

Use these test phone numbers in sandbox mode:

- `256700000000` - Success scenario
- `256700000001` - Failure scenario

## Monitoring

The service includes comprehensive logging:

- **Payment Requests**: Logged with transaction details
- **API Calls**: Request/response logging for debugging
- **Errors**: Detailed error logging with context
- **Callbacks**: Webhook processing logs

## Migration

Apply the database migration:

```bash
cd rendasua/apps/hasura
hasura migrate apply --database-name Rendasua --admin-secret myadminsecretkey
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Check your `client_id` and `client_secret`
2. **Network Errors**: Verify the API endpoint URLs
3. **Callback Errors**: Ensure your callback URL is accessible
4. **Database Errors**: Check the migration has been applied

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
```

## Support

For issues with the Airtel Money API integration:

1. Check the [Airtel Money API documentation](https://developers.airtel.africa/documentation/collection-apis/2.0)
2. Review the service logs for detailed error information
3. Contact Airtel Money support for API-specific issues
4. Check the application logs for integration-specific errors

## License

This integration is part of the Rendasua project and follows the same licensing terms.
