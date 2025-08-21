# Mobile Payments Module

A comprehensive mobile payments abstraction layer for the Rendasua platform, supporting multiple payment providers with a unified API.

## Overview

This module provides a unified interface for mobile payment operations, currently integrating with [MyPVit](https://docs.mypvit.pro/) for mobile money and card payments. The architecture is designed to easily accommodate additional payment providers in the future.

## Features

- **Multi-Provider Support**: Unified API for different payment providers
- **MyPVit Integration**: Support for Airtel Money, Moov Money, and Visa/Mastercard
- **Transaction Management**: Complete transaction lifecycle management
- **Callback Handling**: Secure callback verification and processing
- **Database Integration**: Transaction logging and status tracking
- **Health Monitoring**: Provider availability and connection status
- **Statistics**: Transaction analytics and reporting

## Architecture

### Core Components

1. **MobilePaymentsService**: Main abstraction layer
2. **MyPVitService**: MyPVit provider implementation
3. **MobilePaymentsDatabaseService**: Database operations
4. **MobilePaymentsController**: REST API endpoints

### Provider Abstraction

The module uses a provider pattern to abstract different payment services:

```typescript
interface PaymentProvider {
  name: string;
  supportedMethods: string[];
  supportedCurrencies: string[];
  isAvailable: boolean;
}
```

## API Endpoints

### Payment Operations

#### Initiate Payment

```http
POST /mobile-payments/initiate
```

**Request Body:**

```json
{
  "amount": 1000,
  "currency": "XAF",
  "reference": "ORDER-123",
  "description": "Payment for order #123",
  "customerPhone": "+241123456789",
  "customerEmail": "customer@example.com",
  "callbackUrl": "https://api.rendasua.com/mobile-payments/callback/mypvit",
  "returnUrl": "https://rendasua.com/payment/success",
  "provider": "mypvit",
  "paymentMethod": "mobile_money"
}
```

#### Check Balance

```http
GET /mobile-payments/balance?provider=mypvit
```

#### Renew Secret Key

```http
POST /mobile-payments/renew-secret?provider=mypvit
```

#### Perform KYC

```http
POST /mobile-payments/kyc?provider=mypvit
```

**Request Body:**

```json
{
  "customerPhone": "+241123456789",
  "customerName": "John Doe",
  "customerId": "ID123456",
  "customerEmail": "john.doe@example.com"
}
```

#### Check Transaction Status

```http
GET /mobile-payments/transactions/{transactionId}/status
```

#### Cancel Transaction

```http
POST /mobile-payments/transactions/{transactionId}/cancel
```

### Provider Management

#### Get Available Providers

```http
GET /mobile-payments/providers
```

#### Get Supported Methods

```http
GET /mobile-payments/providers/{provider}/methods
```

### Transaction Management

#### Get Transaction

```http
GET /mobile-payments/transactions/{transactionId}
```

#### Get Transaction by Reference

```http
GET /mobile-payments/transactions/reference/{reference}
```

#### Get Transaction History

```http
GET /mobile-payments/transactions?provider=mypvit&status=success&limit=10&offset=0
```

#### Get Statistics

```http
GET /mobile-payments/statistics?provider=mypvit&startDate=2024-01-01&endDate=2024-12-31
```

### Callback Handling

#### Payment Callback

```http
POST /mobile-payments/callback/{provider}
```

### Health Check

#### Service Health

```http
GET /mobile-payments/health
```

## MyPVit Integration

### Supported Payment Methods

- **Mobile Money**: Airtel Money, Moov Money
- **Cards**: Visa, Mastercard
- **Bank Transfers**: Direct bank transfers
- **Currencies**: XAF, USD, EUR

### API Endpoints

The module integrates with the following MyPVit API endpoints:

- **REST API**: `/X5T3RIBYQUDFBZSH/rest` - Payment initiation
- **Status API**: `/RYXA6SLFNRBFFQJX/status` - Transaction status checking
- **Balance API**: `/LIRYOTW7QL3DCDPJ/balance` - Merchant balance checking
- **Secret Renewal**: `/CTCNJRBWZIDALEGT/renew-secret` - Secret key renewal
- **KYC API**: `/W2OZPE4QDSWH3Z5R/kyc` - Customer verification

### Configuration

Add the following environment variables:

```env
MYPVIT_BASE_URL=https://api.mypvit.pro
MYPVIT_MERCHANT_SLUG=MR_1755783875
MYPVIT_SECRET_KEY=CTCNJRBWZIDALEGT
MYPVIT_ENVIRONMENT=test  # or production
```

**Test Environment Credentials:**

- **Merchant Slug**: `MR_1755783875`
- **Secret Key**: `CTCNJRBWZIDALEGT`
- **Base URL**: `https://api.mypvit.pro`

### Authentication

The module uses signature-based authentication as per MyPVit's requirements:

1. **Request Signing**: Each request is signed with a SHA256 hash
2. **Timestamp**: Requests include a timestamp for security
3. **Headers**: Authentication headers are automatically added

### Callback Verification

All callbacks are verified using signature validation to ensure authenticity.

## Database Schema

### Mobile Payment Transactions

```sql
CREATE TABLE mobile_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(255) NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  description TEXT,
  provider VARCHAR(50) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(255),
  payment_url TEXT,
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  callback_url TEXT,
  return_url TEXT,
  error_message TEXT,
  error_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Payment Callbacks

```sql
CREATE TABLE payment_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES mobile_payment_transactions(id),
  callback_data JSONB NOT NULL,
  received_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Examples

### Basic Payment Flow

```typescript
// 1. Initiate payment
const paymentResponse = await mobilePaymentsService.initiatePayment({
  amount: 1000,
  currency: 'XAF',
  reference: 'ORDER-123',
  description: 'Payment for order #123',
  customerPhone: '+241123456789',
  provider: 'mypvit',
  paymentMethod: 'mobile_money',
});

// 2. Redirect user to payment URL
if (paymentResponse.success) {
  window.location.href = paymentResponse.paymentUrl;
}

// 3. Check status (polling or callback)
const status = await mobilePaymentsService.checkTransactionStatus(paymentResponse.transactionId);
```

### Provider Selection

```typescript
// Get available providers
const providers = await mobilePaymentsService.getAvailableProviders();

// Select best provider based on requirements
const bestProvider = providers.find((p) => p.isAvailable && p.supportedMethods.includes('mobile_money') && p.supportedCurrencies.includes('XAF'));
```

## Error Handling

The module provides comprehensive error handling:

- **Provider Errors**: Network issues, API errors
- **Validation Errors**: Invalid request data
- **Authentication Errors**: Invalid signatures
- **Database Errors**: Transaction failures

All errors are logged and returned with appropriate HTTP status codes.

## Security Features

1. **Signature Verification**: All callbacks are verified
2. **Request Signing**: Outgoing requests are signed
3. **Timestamp Validation**: Prevents replay attacks
4. **Error Logging**: Comprehensive error tracking
5. **Input Validation**: Request data validation

## Monitoring and Logging

- **Transaction Logging**: All transactions are logged
- **Callback Logging**: Payment callbacks are recorded
- **Error Logging**: Detailed error information
- **Health Monitoring**: Provider availability checks
- **Statistics**: Transaction analytics

## Future Enhancements

### Planned Providers

- **MTN Mobile Money**: MTN MoMo integration
- **Orange Money**: Orange Money integration
- **Bank Transfers**: Direct bank transfer support

### Additional Features

- **Webhook Support**: Real-time payment notifications
- **Retry Logic**: Automatic retry for failed transactions
- **Rate Limiting**: API rate limiting
- **Caching**: Response caching for performance
- **Analytics**: Advanced payment analytics

## Development

### Adding a New Provider

1. Create a new provider service in `providers/`
2. Implement the provider interface
3. Register the provider in `MobilePaymentsService`
4. Add provider-specific configuration
5. Update tests and documentation

### Testing

```bash
# Run unit tests
npm run test mobile-payments

# Run integration tests
npm run test:e2e mobile-payments
```

### Environment Setup

```bash
# Development
cp .env.example .env.development

# Production
cp .env.example .env.production
```

## Support

For MyPVit integration support:

- 📧 contact@mypvit.pro
- 📞 (+241) 74 72 13 98
- 🌐 [mypvit.pro](https://mypvit.pro)

For module support:

- 📧 support@rendasua.com
- 📖 [Documentation](https://docs.rendasua.com)
