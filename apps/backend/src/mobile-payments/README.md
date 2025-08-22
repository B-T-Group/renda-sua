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
  "callbackUrl": "https://api.rendasua.com/mobile-payments/callback/pvit",
  "returnUrl": "https://rendasua.com/payment/success",
  "provider": "mypvit",
  "paymentMethod": "mobile_money",
  "agent": "AGENT-1",
  "product": "PRODUIT-1"
}
```

#### Check Balance

```http
GET /mobile-payments/balance?provider=mypvit
```

#### Secret Refresh Webhook Callback

```http
POST /mobile-payments/callback/secret-refresh?provider=mypvit
```

**Request Body:**

```json
{
  "operation_account_code": "ACC_672CD66E148BD",
  "secret_key": "sk_live_xxx",
  "expires_in": 3600
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Secret key updated successfully",
    "secretName": "development-rendasua-backend-secrets",
    "operation_account_code": "ACC_672CD66E148BD",
    "expires_in": 3600,
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
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

#### MyPVIT Payment Callback

```http
POST /mobile-payments/callback/pvit
```

**Request Body:**

```json
{
  "transactionId": "PAY240420250001",
  "merchantReferenceId": "REF123456",
  "status": "SUCCESS",
  "amount": 200.0,
  "customerID": "066820866",
  "fees": 5.0,
  "chargeOwner": "CUSTOMER",
  "transactionOperation": "PAYMENT",
  "operator": "MOOV_MONEY",
  "code": 200
}
```

**Response:**

```json
{
  "success": true,
  "message": "Callback processed successfully",
  "transactionId": "PAY240420250001",
  "merchantReferenceId": "REF123456",
  "status": "SUCCESS"
}
```

**Status Values:**

- `SUCCESS`: Payment was successful
- `FAILED`: Payment failed

#### Generic Payment Callback (Backward Compatibility)

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
MYPVIT_CALLBACK_URL_CODE=FJXSU
MYPVIT_MERCHANT_OPERATION_ACCOUNT_CODE=ACC_68A722C33473B
API_BASE_URL=https://api.rendasua.com  # For callback URLs
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

### MyPVIT Request Format

The system automatically converts your request to the MyPVIT API format:

```json
{
  "agent": "AGENT-1",
  "amount": 200,
  "product": "PRODUIT-1",
  "reference": "REF123456",
  "service": "RESTFUL",
  "callback_url_code": "FJXSU",
  "customer_account_number": "066820866",
  "merchant_operation_account_code": "ACC_68A722C33473B",
  "transaction_type": "PAYMENT",
  "owner_charge": "CUSTOMER",
  "operator_owner_charge": "MERCHANT",
  "free_info": "Info libre"
}
```

**Field Descriptions:**

- `agent`: Agent identifier (optional)
- `amount`: Transaction amount (> 150 XAF)
- `product`: Product name (optional)
- `reference`: Unique transaction reference (max 15 characters)
- `service`: Service type (always "RESTFUL")
- `callback_url_code`: Callback URL code (configurable)
- `customer_account_number`: Customer phone number (max 20 characters)
- `merchant_operation_account_code`: Merchant operation account (configurable)
- `transaction_type`: Transaction type (always "PAYMENT")
- `owner_charge`: Entity paying PVit fees ("MERCHANT" or "CUSTOMER")
- `operator_owner_charge`: Entity paying operator fees (optional)
- `free_info`: Free information (optional)

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
  transaction_id UUID NOT NULL REFERENCES mobile_payment_transactions(id) ON DELETE CASCADE,
  callback_data JSONB NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);
```

## Usage Examples

### Initiating a Payment

```typescript
const paymentRequest = {
  amount: 5000,
  currency: 'XAF',
  reference: 'ORDER-123',
  description: 'Payment for order #123',
  customerPhone: '+241123456789',
  provider: 'mypvit',
  paymentMethod: 'mobile_money',
};

const response = await mobilePaymentsService.initiatePayment(paymentRequest);
```

### Handling Callbacks

The system automatically handles MyPVIT callbacks at `/mobile-payments/callback/pvit` and updates transaction status accordingly.

### Checking Transaction Status

```typescript
const status = await mobilePaymentsService.checkTransactionStatus('PAY240420250001');
console.log(`Transaction status: ${status.status}`);
```

## Error Handling

The module provides comprehensive error handling:

- **Validation Errors**: Invalid request data
- **Provider Errors**: Payment provider API errors
- **Network Errors**: Connection issues
- **Database Errors**: Transaction storage issues

All errors are logged and returned with appropriate HTTP status codes.

## Security Considerations

1. **Signature Verification**: All callbacks are verified using cryptographic signatures
2. **Secret Management**: Sensitive data is stored in AWS Secrets Manager
3. **Input Validation**: All inputs are validated before processing
4. **Error Logging**: Errors are logged without exposing sensitive information

## Monitoring and Logging

The module provides comprehensive logging:

- **Payment Initiation**: Logs all payment requests
- **Callback Processing**: Logs all callback data
- **Error Tracking**: Detailed error logging
- **Performance Metrics**: Transaction processing times

## Future Enhancements

- **Additional Providers**: Support for more payment providers
- **Webhook Management**: Dynamic webhook URL management
- **Retry Logic**: Automatic retry for failed transactions
- **Analytics Dashboard**: Real-time transaction analytics
- **Multi-Currency Support**: Enhanced currency handling
