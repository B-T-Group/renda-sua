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
  "description": "Payment for order #123",
  "customerPhone": "+241123456789",
  "customerEmail": "customer@example.com",
  "callbackUrl": "https://api.rendasua.com/mobile-payments/callback/pvit",
  "returnUrl": "https://rendasua.com/payment/success",
  "provider": "mypvit",
  "paymentMethod": "mobile_money",
  "accountId": "account-uuid-here"
}
```

#### Check Balance

```http
GET /mobile-payments/balance?provider=mypvit
```

#### Secret Refresh Webhook Callback (MyPVit "URL de réception de clé secrète")

```http
POST /mobile-payments/secret-refresh/<MYPVIT_SECRET_REFRESH_TOKEN>
```

Overwrites the live MyPVit operation-account secret, so it fails closed:

- **Token in the URL:** register the URL above, with the token as its last path segment, in the MyPVit portal (Paramétrages → Urls → "Réception de clé secrète"). MyPVit documents no signature or custom header for this call.
  - Store the token in Secrets Manager as `MYPVIT_SECRET_REFRESH_TOKEN`: at least 32 random characters, e.g. `openssl rand -base64 48 | tr -d '/+=' | cut -c1-48`.
  - It is compared in constant time (SHA-256 of both sides, then `timingSafeEqual`).
- **Source IP:** `req.ip` must be one of MyPVit's documented IPs (`176.31.65.18`, `176.31.65.20`, `176.31.65.21`, `13.59.249.167`, from docs.mypvit.pro "liste blanche").
  - Override with `MYPVIT_SECRET_REFRESH_ALLOWED_IPS` (comma separated). An empty or blank override falls back to the documented list; it never means "allow all".
  - Exact IPv4 match only: no CIDR ranges and no IPv6 (an IPv4-mapped `::ffff:a.b.c.d` is normalised to `a.b.c.d`).
  - `req.ip` is only trustworthy with `trust proxy = 1` (one hop: the Lightsail load balancer). The backend refuses to start in production if `TRUST_PROXY` resolves to anything else; leave it unset or set it to `1`.
- **One answer for every auth failure:** the IP check and the token compare always both run, and an unconfigured token, a non-allow-listed IP and a wrong token all return the same `401 {"success":false,"message":"Unauthorized"}`. The reason (and the caller IP) goes to the log only.
- **Account codes:** `MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE` and `MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE` must be set. There is no fallback in code: `MyPVitService` throws at construction, so **the backend fails at boot** when either is missing or blank. Identical codes still boot (payments work; DEV's sandbox config uses one account for both), but `MyPVitService` warns, and this webhook refuses deliveries with 503 because it can't tell which key to rotate.
- **Secret name:** `MYPVIT_SECRET_NAME` wins if set. Otherwise the same rule as `main.ts`: `DEPLOYMENT_ENV` (then `NODE_ENV`) equal to `production` gives `production-rendasua-backend-secrets`; anything else gives `development-rendasua-backend-secrets`. The webhook writer and `MyPVitService`'s reader use the same function.
- **Old URL:** the unauthenticated `POST /mobile-payments/secret-refresh` always returns 401.

**Request body.** docs.mypvit.pro documents the renewed secret as `SyncSecretKeyResponse { operation_account_code, secret, expires_in }` (the synchronous v2 `renew-secret` response). The body MyPVit pushes to the reception URL after the v1 `renew-secret` call (the one our refresh Lambdas make) is not documented, and this handler historically read `merchant_operation_account_code` / `secret_key`. Both spellings are accepted; the documented one wins when both are non-empty:

```json
{ "operation_account_code": "ACC_xxx", "secret": "sk_live_xxx", "expires_in": 3600 }
{ "merchant_operation_account_code": "ACC_xxx", "secret_key": "sk_live_xxx", "expires_in": 3600 }
```

**Responses:**
- `200 { "success": true, "data": { "updated_at": "…" } }`. It echoes nothing about the secret store.
- 401: any auth failure (token missing/wrong/unconfigured, or IP not allowed), identical body.
- 400: invalid payload (missing/blank/oversized secret, missing account code) or unknown account code.
- 503: account codes identical (or missing at request time, defence in depth).
- 500: store failure, with a generic body; only the error class name is logged.

**Deploy runbook (do these in order):**
1. In Secrets Manager (`production-rendasua-backend-secrets`; `development-…` for DEV) set `MYPVIT_SECRET_REFRESH_TOKEN` (≥32 random chars) and both account codes. Production: Airtel `ACC_68B8C1E5663B4`, Moov `ACC_68F90896204C1`. Check that `TRUST_PROXY` is absent or `1`. Without the codes the new build will not boot.
2. Deploy the backend. Confirm it started (no "MyPVit misconfigured" / "Refusing to start: trust proxy" in the logs).
3. In the MyPVit portal, update the reception URL code `BQ1TV` (prod; `TRUVU` on DEV) to `https://<api-host>/api/mobile-payments/secret-refresh/<token>`.
4. Invoke the `refresh-airtel-…` and `refresh-moov-…` Lambdas once by hand.
5. Confirm the backend log line `MyPVit secret refresh stored AIRTEL_MYPVIT_SECRET_KEY` (and `MOOV_…`) and that a MyPVit status call still works.
6. Rollback: redeploy the previous image and point `BQ1TV` back to `/api/mobile-payments/secret-refresh`. The secrets already stored stay valid; only the new token entry becomes unused.

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
  "amount": 200,
  "reference": "P12345678abcd",
  "service": "RESTFUL",
  "callback_url_code": "FJXSU",
  "customer_account_number": "123456789",
  "merchant_operation_account_code": "ACC_68A722C33473B",
  "transaction_type": "PAYMENT",
  "owner_charge": "CUSTOMER",
  "free_info": "Info libre"
}
```

**Field Descriptions:**

- `amount`: Transaction amount (> 150 XAF)
- `reference`: Unique transaction reference (auto-generated by backend, max 15 characters)
- `service`: Service type (always "RESTFUL")
- `callback_url_code`: Callback URL code (configurable)
- `customer_account_number`: Customer phone number without country code (max 20 characters, validated using Google's libphonenumber)
- `merchant_operation_account_code`: Merchant operation account (configurable)
- `transaction_type`: Transaction type (always "PAYMENT")
- `owner_charge`: Entity paying PVit fees ("MERCHANT" or "CUSTOMER")

- `free_info`: Free information (optional)

### Phone Number Validation

The system uses Google's libphonenumber library to validate and format phone numbers:

- **Validation**: Phone numbers are validated for format and region
- **Country Code Removal**: Country codes are automatically removed using the library
- **Default Region**: Gabon (GA) is used as the default region for parsing
- **Error Handling**: Invalid phone numbers return an error response

#### Supported Formats:

- International format: `+241123456789`
- National format: `123456789` (with default region)
- Various country codes: US (+1), France (+33), Gabon (+241), etc.

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
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
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
