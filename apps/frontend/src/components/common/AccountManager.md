# AccountManager Component

A reusable, comprehensive account management component that provides read-only access to account information and transaction history across different entity types (agents, clients, businesses) in the Rendasua platform.

## Features

- **Universal Entity Support**: Works with agents, clients, and businesses
- **Read-Only Access**: View accounts and transaction history (no account creation)
- **Transaction History**: Detailed transaction viewing with pagination
- **Multi-Currency Support**: Handles multiple currencies with proper formatting
- **Account Summary**: Total balance overview across all currencies
- **Type Safety**: Full TypeScript support with proper interfaces
- **Internationalization**: Full i18n support with translations
- **Material-UI Integration**: Consistent design with skeleton loading states
- **Error Handling**: Comprehensive error handling and user feedback
- **Responsive Design**: Works on all screen sizes

## Usage

### Basic Usage

```tsx
import AccountManager from '../common/AccountManager';

const MyComponent = () => {
  const userId = 'user-uuid-here';

  return <AccountManager entityType="client" entityId={userId} />;
};
```

### Advanced Usage

```tsx
import AccountManager from '../common/AccountManager';

const BusinessAccountManager = () => {
  const userId = 'business-user-uuid';

  return <AccountManager entityType="business" entityId={userId} title="Business Accounts" showTransactions={true} showTotalSummary={true} maxTransactions={20} compactView={false} emptyStateMessage="No business accounts found. Accounts are created automatically when you make your first transaction." />;
};
```

## Props

| Prop                | Type                                | Required | Default         | Description                                |
| ------------------- | ----------------------------------- | -------- | --------------- | ------------------------------------------ |
| `entityType`        | `'agent' \| 'client' \| 'business'` | Yes      | -               | The type of entity to manage accounts for  |
| `entityId`          | `string`                            | Yes      | -               | The user ID of the entity (not profile ID) |
| `title`             | `string`                            | No       | Auto-generated  | Custom title for the account section       |
| `showTransactions`  | `boolean`                           | No       | `true`          | Whether to show transaction history dialog |
| `showTotalSummary`  | `boolean`                           | No       | `true`          | Whether to show total balance summary      |
| `maxTransactions`   | `number`                            | No       | `10`            | Maximum number of transactions to display  |
| `compactView`       | `boolean`                           | No       | `false`         | Whether to show compact account cards      |
| `emptyStateMessage` | `string`                            | No       | Default message | Custom message when no accounts exist      |

## Account Information

The component displays the following account information:

- **Currency**: The account currency (USD, EUR, XAF, etc.)
- **Available Balance**: Amount available for transactions
- **Total Balance**: Complete account balance
- **Withheld Balance**: Amount temporarily held
- **Account Status**: Active/Inactive status
- **Creation Date**: When the account was created

## Transaction Types

The component supports various transaction types:

- **credit**: Money added to account
- **debit**: Money removed from account
- **transfer**: Money transferred between accounts
- **refund**: Refunded transactions
- **fee**: Service fees charged
- **commission**: Commission payments

## Database Schema

The component works with the following database structure:

### Tables

1. **accounts**: Main account table

   - `id`: UUID primary key
   - `user_id`: Reference to user (required)
   - `currency`: Account currency (required)
   - `available_balance`: Available balance amount
   - `withheld_balance`: Temporarily held amount
   - `total_balance`: Complete balance amount
   - `is_active`: Account status flag
   - `created_at`: Account creation timestamp
   - `updated_at`: Last update timestamp

2. **account_transactions**: Transaction history table
   - `id`: UUID primary key
   - `account_id`: Reference to account
   - `transaction_type`: Type of transaction
   - `amount`: Transaction amount (positive/negative)
   - `currency`: Transaction currency
   - `description`: Transaction description
   - `reference_id`: Optional reference ID
   - `reference_type`: Optional reference type
   - `balance_before`: Balance before transaction
   - `balance_after`: Balance after transaction
   - `created_at`: Transaction timestamp

## Hook Integration

The component uses the `useAccountManager` hook which provides:

### Data

- `accounts`: Array of accounts for the user
- `transactions`: Array of transactions for selected account
- `selectedAccount`: Currently selected account
- `loading`: Loading state for accounts
- `transactionsLoading`: Loading state for transactions
- `error`: Error message if any

### Actions

- `fetchAccounts()`: Reload accounts from the server
- `fetchAccountTransactions(accountId, limit)`: Fetch transactions for an account
- `selectAccount(account)`: Select an account for viewing
- `clearSelectedAccount()`: Clear selected account
- `clearError()`: Clear error messages

### Computed Values

- `getAccountByCurrency(currency)`: Get account by currency
- `getTotalBalance(currency?)`: Get total balance across accounts
- `getAvailableBalance(currency?)`: Get available balance across accounts

## GraphQL Operations

The component performs the following GraphQL operations:

### Queries

- `GET_USER_ACCOUNTS`: Fetch all accounts for a user
- `GET_ACCOUNT_TRANSACTIONS`: Fetch transaction history for an account

### Key Features

- **No Mutations**: Read-only component (no account creation/modification)
- **Pagination**: Transaction history supports pagination
- **Filtering**: Transactions can be filtered by account
- **Sorting**: Transactions are sorted by date (newest first)

## Translation Keys

The component uses the following translation keys:

```json
{
  "accounts": {
    "title": "Accounts",
    "account": "Account",
    "summary": "Account Summary",
    "accountSummary": "Account Summary",
    "noAccounts": "No accounts found.",
    "active": "Active",
    "inactive": "Inactive",
    "availableBalance": "Available Balance",
    "totalBalance": "Total Balance",
    "withheldBalance": "Withheld Balance",
    "available": "Available",
    "createdAt": "Created",
    "transactionHistory": "Transaction History",
    "recentTransactions": "Recent Transactions",
    "noTransactions": "No transactions found.",
    "loadMore": "Load More",
    "date": "Date",
    "type": "Type",
    "description": "Description",
    "amount": "Amount",
    "balance": "Balance",
    "transactionTypes": {
      "credit": "Credit",
      "debit": "Debit",
      "transfer": "Transfer",
      "refund": "Refund",
      "fee": "Fee",
      "commission": "Commission"
    }
  }
}
```

## Examples

### Profile Page Integration

```tsx
// In Profile.tsx
import AccountManager from '../common/AccountManager';

const Profile = () => {
  const { userProfile } = useProfile();

  return <AccountManager entityType={userProfile.user_type_id} entityId={userProfile.id} title="Account Overview" showTransactions={true} showTotalSummary={true} maxTransactions={10} emptyStateMessage="No accounts found. Accounts are automatically created when you make your first transaction." />;
};
```

### Business Dashboard Integration

```tsx
// For business account overview
<AccountManager entityType="business" entityId={businessUserId} title="Business Accounts" showTransactions={true} showTotalSummary={true} maxTransactions={15} compactView={false} />
```

### Agent Earnings Dashboard

```tsx
// For agent commission tracking
<AccountManager entityType="agent" entityId={agentUserId} title="Agent Earnings" showTransactions={true} showTotalSummary={true} maxTransactions={20} emptyStateMessage="No earnings accounts found." />
```

### Client Wallet View

```tsx
// For client wallet overview
<AccountManager entityType="client" entityId={clientUserId} title="My Wallet" showTransactions={true} showTotalSummary={true} maxTransactions={10} compactView={true} />
```

## Error Handling

The component handles various error scenarios:

- **Network errors**: Connection issues with the GraphQL API
- **User not found**: Invalid user ID provided
- **No accounts**: User has no accounts (shows empty state)
- **Transaction loading errors**: Issues fetching transaction history
- **Currency formatting errors**: Invalid currency codes

## Performance Considerations

- **Lazy loading**: Accounts are only fetched when needed
- **Transaction pagination**: Transactions are loaded in batches
- **Skeleton loading**: Provides immediate visual feedback
- **Error boundaries**: Graceful error handling
- **Optimized queries**: Efficient GraphQL queries with proper field selection

## Best Practices

1. **Always provide user ID**: Use the user's ID, not profile-specific IDs
2. **Handle empty states**: Provide meaningful empty state messages
3. **Customize for use case**: Use appropriate props for your specific needs
4. **Consider performance**: Use appropriate transaction limits
5. **Test error scenarios**: Handle network failures gracefully

## Security Considerations

- **Read-only access**: No account creation or modification capabilities
- **User-specific data**: Only shows accounts for the specified user
- **Permission-based**: Relies on GraphQL permissions for data access
- **No sensitive operations**: No financial operations (transfers, withdrawals)

## Migration Guide

If you're migrating from the old account handling in Profile.tsx:

### Before

```tsx
// Old approach with manual account handling
const [accounts, setAccounts] = useState([]);
const [accountDialogOpen, setAccountDialogOpen] = useState(false);

// Manual account creation
const handleAddAccount = () => { ... };
const handleAccountSave = () => { ... };

// Custom account display
{accounts.map(account => (
  <Card key={account.id}>
    {/* Manual account display */}
  </Card>
))}
```

### After

```tsx
// New approach with AccountManager
<AccountManager entityType={userType} entityId={userId} title="Account Overview" showTransactions={true} />
```

## Integration with Other Components

The AccountManager can be integrated with:

- **TopUpModal**: For account top-up functionality (external integration)
- **TransactionDialog**: For detailed transaction viewing
- **PaymentComponents**: For payment-related operations
- **Dashboard**: For account overview displays

## Contributing

When contributing to the AccountManager component:

1. **Follow the existing patterns**: Use the same coding style and patterns
2. **Add tests**: Include unit tests for new features
3. **Update translations**: Add new translation keys to both en.json and fr.json
4. **Update documentation**: Keep this documentation up to date
5. **Consider backwards compatibility**: Avoid breaking changes when possible
6. **Security first**: Ensure read-only access is maintained

## Related Components

- **AddressManager**: Similar pattern for address management
- **useAccountManager**: The underlying hook for data management
- **TopUpModal**: External component for account top-ups
- **ConfirmationModal**: Used for confirmations (if needed)
- **LoadingSpinner**: Used for loading states
