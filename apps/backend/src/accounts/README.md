# Accounts Service

This module provides account management functionality including transaction registration and balance tracking.

## Services

### AccountsService

The main service for handling account operations and transactions.

#### Methods

##### `registerTransaction(request: TransactionRequest): Promise<TransactionResult>`

Registers a transaction and updates account balances based on the transaction type.

**Parameters:**

- `request.accountId`: The account ID to perform the transaction on
- `request.amount`: The transaction amount (must be > 0)
- `request.transactionType`: Type of transaction (see supported types below)
- `request.memo`: Optional memo/description for the transaction
- `request.referenceId`: Optional reference ID (e.g., order ID, payment ID)

**Supported Transaction Types:**

| Type         | Description                  | Balance Effect                      |
| ------------ | ---------------------------- | ----------------------------------- |
| `deposit`    | Money added to account       | Credits available balance           |
| `withdrawal` | Money removed from account   | Debits available balance            |
| `hold`       | Money held for pending order | Debits available, credits withheld  |
| `release`    | Money released from hold     | Credits available, debits withheld  |
| `transfer`   | Transfer between accounts    | Debits available balance            |
| `payment`    | Payment for order/service    | Debits available balance            |
| `refund`     | Refund for cancelled order   | Credits available balance           |
| `fee`        | Service fee                  | Debits available balance            |
| `adjustment` | Manual balance adjustment    | Can credit or debit based on amount |
| `exchange`   | Currency exchange            | Credits available balance           |

**Returns:**

```typescript
{
  success: boolean;
  transactionId?: string;
  newBalance?: {
    available: number;
    withheld: number;
    total: number;
  };
  error?: string;
}
```

**Example Usage:**

```typescript
// Deposit money
const result = await accountsService.registerTransaction({
  accountId: 'account-uuid',
  amount: 100.0,
  transactionType: 'deposit',
  memo: 'Initial deposit',
  referenceId: 'payment-uuid',
});

// Hold money for order
const holdResult = await accountsService.registerTransaction({
  accountId: 'account-uuid',
  amount: 50.0,
  transactionType: 'hold',
  memo: 'Hold for order #12345',
  referenceId: 'order-uuid',
});

// Release hold
const releaseResult = await accountsService.registerTransaction({
  accountId: 'account-uuid',
  amount: 50.0,
  transactionType: 'release',
  memo: 'Release hold for order #12345',
  referenceId: 'order-uuid',
});
```

##### `getAccountTransactions(accountId: string, limit?: number, offset?: number): Promise<any[]>`

Retrieves transaction history for an account.

##### `getAccountBalance(accountId: string): Promise<any>`

Retrieves current balance information for an account.

## API Endpoints

### POST `/accounts/transaction`

Registers a new transaction.

**Request Body:**

```json
{
  "accountId": "uuid",
  "amount": 100.0,
  "transactionType": "deposit",
  "memo": "Optional memo",
  "referenceId": "optional-reference-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "transactionId": "transaction-uuid",
  "newBalance": {
    "available": 100.0,
    "withheld": 0.0,
    "total": 100.0
  }
}
```

## Error Handling

The service includes comprehensive error handling for:

- Missing required fields
- Invalid amounts (≤ 0)
- Account not found
- Insufficient funds for debit transactions
- Unsupported transaction types

## Database Schema

The service works with the following database tables:

- `accounts`: User accounts with available and withheld balances
- `account_transactions`: Transaction history with type, amount, memo, and reference

## Integration with Orders Service

This service can be used to replace the existing transaction methods in the OrdersService:

- `captureTransaction`
- `releaseHoldOnAccount`
- `placeHoldOnAccount`

The new service provides a more centralized and consistent approach to transaction management.
