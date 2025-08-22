import { useEffect, useRef, useState } from 'react';
import { useAccountSubscription } from './useAccountSubscription';
import { useGraphQLRequest } from './useGraphQLRequest';

const GET_ACCOUNT_INFO = `
  query GetAccountInfo {
    accounts {
      id
      user_id
      currency
      available_balance
      withheld_balance
      total_balance
      is_active
      created_at
      updated_at
      account_transactions {
        id
        account_id
        transaction_type
        amount
        memo
        created_at
      }
    }
    clients {
      id
      user_id
      created_at
      updated_at
    }
  }
`;

const GET_ACCOUNT_BY_ID = `
  query GetAccountById($accountId: uuid!) {
    accounts_by_pk(id: $accountId) {
      id
      user_id
      currency
      available_balance
      withheld_balance
      total_balance
      is_active
      created_at
      updated_at
      account_transactions {
        id
        account_id
        transaction_type
        amount
        memo
        created_at
      }
    }
  }
`;

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
  account_transactions: Array<{
    id: string;
    account_id: string;
    transaction_type: string;
    amount: number;
    memo: string;
    created_at: string;
  }>;
}

export interface ClientInfo {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const useAccountInfo = () => {
  const { data, loading, error, execute, refetch } = useGraphQLRequest<{
    accounts: Account[];
    clients: ClientInfo[];
  }>(GET_ACCOUNT_INFO);

  const hasExecuted = useRef(false);

  useEffect(() => {
    if (!hasExecuted.current) {
      hasExecuted.current = true;
      setTimeout(() => {
        execute();
      }, 0);
    }
  }, []); // Empty dependency array

  const accounts: Account[] = data?.accounts || [];
  const clientInfo: ClientInfo[] = data?.clients || [];

  return {
    accounts,
    clientInfo,
    loading,
    error,
    refetch: () => refetch(),
  };
};

export const useAccountById = (accountId: string) => {
  const { data, loading, error, execute, refetch } = useGraphQLRequest<{
    accounts_by_pk: Account;
  }>(GET_ACCOUNT_BY_ID);

  const hasExecuted = useRef(false);
  const [localAccount, setLocalAccount] = useState<Account | null>(null);

  // Set up subscription for real-time account updates
  const {
    loading: subscriptionLoading,
    error: subscriptionError,
    subscriptionFailed,
  } = useAccountSubscription({
    accountId: accountId,
    onAccountUpdate: (updatedAccount) => {
      console.log('Account subscription update received:', updatedAccount);
      setLocalAccount(updatedAccount);
    },
    enabled: !!accountId,
  });

  // Update local state when query data changes
  useEffect(() => {
    if (data?.accounts_by_pk) {
      setLocalAccount(data.accounts_by_pk);
    }
  }, [data]);

  useEffect(() => {
    if (!hasExecuted.current && accountId) {
      hasExecuted.current = true;
      setTimeout(() => {
        execute({ accountId });
      }, 0);
    }
  }, [accountId, execute]);

  // Use local state for account (which includes subscription updates)
  // Fall back to query data if no subscription updates have been received
  const account: Account | null = localAccount || data?.accounts_by_pk || null;

  return {
    account,
    loading: loading || subscriptionLoading,
    error: error || subscriptionError,
    subscriptionFailed,
    refetch: () => refetch({ accountId }),
  };
};
