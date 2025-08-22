import { useCallback, useEffect, useState } from 'react';
import { useAccountSubscription } from './useAccountSubscription';
import { useGraphQLRequest } from './useGraphQLRequest';

export interface Account {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  total_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type EntityType = 'agent' | 'client' | 'business';

interface AccountManagerConfig {
  entityType: EntityType;
  entityId: string;
  autoFetch?: boolean;
}

// GraphQL queries for fetching accounts
const GET_USER_ACCOUNTS = `
  query GetUserAccounts($userId: uuid!) {
    accounts(where: { user_id: { _eq: $userId } }) {
      id
      user_id
      currency
      available_balance
      withheld_balance
      total_balance
      is_active
      created_at
      updated_at
    }
  }
`;

const GET_ACCOUNT_TRANSACTIONS = `
  query GetAccountTransactions($accountId: uuid!, $limit: Int = 10) {
    account_transactions(
      where: { account_id: { _eq: $accountId } }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      id
      account_id
      transaction_type
      amount
      memo
      reference_id
      created_at
      account {
        currency
      }
    }
  }
`;

export interface AccountTransaction {
  id: string;
  account_id: string;
  transaction_type: string;
  amount: number;
  memo?: string;
  reference_id?: string;
  created_at: string;
  account: {
    currency: string;
  };
}

export const useAccountManager = (config: AccountManagerConfig) => {
  const { entityType, entityId, autoFetch = true } = config;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Set up account subscription
  const {
    loading: subscriptionLoading,
    error: subscriptionError,
    subscriptionFailed,
  } = useAccountSubscription({
    userId: entityId,
    onAccountUpdate: (updatedAccounts) => {
      console.log('Account subscription update received:', updatedAccounts);
      setAccounts(updatedAccounts);
    },
    enabled: autoFetch && !!entityId,
  });

  // GraphQL hooks
  const { execute: executeAccountsQuery } =
    useGraphQLRequest(GET_USER_ACCOUNTS);
  const { execute: executeTransactionsQuery } = useGraphQLRequest(
    GET_ACCOUNT_TRANSACTIONS
  );

  // Fetch accounts for the user
  const fetchAccounts = useCallback(async () => {
    if (!entityId) return;

    setLoading(true);
    setError(null);

    try {
      // For all entity types, we fetch accounts by user_id
      // The entityId should be the user_id for the entity
      const result = await executeAccountsQuery({ userId: entityId });

      const accountData = result.accounts || [];
      setAccounts(accountData);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }, [entityId, executeAccountsQuery]);

  // Fetch transactions for a specific account
  const fetchAccountTransactions = useCallback(
    async (accountId: string, limit: number = 10) => {
      setTransactionsLoading(true);
      setError(null);

      try {
        const result = await executeTransactionsQuery({ accountId, limit });

        const transactionData = result.account_transactions || [];
        setTransactions(transactionData);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to fetch transactions'
        );
      } finally {
        setTransactionsLoading(false);
      }
    },
    [executeTransactionsQuery]
  );

  // Select an account to view details
  const selectAccount = useCallback(
    (account: Account) => {
      setSelectedAccount(account);
      fetchAccountTransactions(account.id);
    },
    [fetchAccountTransactions]
  );

  // Clear selected account
  const clearSelectedAccount = useCallback(() => {
    setSelectedAccount(null);
    setTransactions([]);
  }, []);

  // Get account by currency
  const getAccountByCurrency = useCallback(
    (currency: string) => {
      return accounts.find((account) => account.currency === currency);
    },
    [accounts]
  );

  // Get total balance across all accounts (in a specific currency or all)
  const getTotalBalance = useCallback(
    (currency?: string) => {
      const filteredAccounts = currency
        ? accounts.filter((account) => account.currency === currency)
        : accounts;

      return filteredAccounts.reduce(
        (total, account) => total + account.total_balance,
        0
      );
    },
    [accounts]
  );

  // Get available balance across all accounts (in a specific currency or all)
  const getAvailableBalance = useCallback(
    (currency?: string) => {
      const filteredAccounts = currency
        ? accounts.filter((account) => account.currency === currency)
        : accounts;

      return filteredAccounts.reduce(
        (total, account) => total + account.available_balance,
        0
      );
    },
    [accounts]
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch accounts when component mounts or entityId changes
  useEffect(() => {
    if (autoFetch && entityId) {
      fetchAccounts();
    }
  }, [autoFetch, entityId, fetchAccounts]);

  return {
    // Data
    accounts,
    transactions,
    selectedAccount,

    // State
    loading,
    transactionsLoading,
    error,
    subscriptionLoading,
    subscriptionError,
    subscriptionFailed,

    // Actions
    fetchAccounts,
    fetchAccountTransactions,
    selectAccount,
    clearSelectedAccount,
    clearError,

    // Computed values
    getAccountByCurrency,
    getTotalBalance,
    getAvailableBalance,
  };
};
