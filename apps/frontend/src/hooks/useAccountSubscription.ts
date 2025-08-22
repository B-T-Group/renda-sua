import { gql, useSubscription } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';

// GraphQL subscription for account updates
const ACCOUNT_SUBSCRIPTION = gql`
  subscription OnAccountUpdate($accountId: uuid!) {
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

interface Account {
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

interface AccountSubscriptionData {
  accounts_by_pk: Account;
}

interface UseAccountSubscriptionProps {
  accountId: string;
  onAccountUpdate?: (account: Account) => void;
  enabled?: boolean;
}

export const useAccountSubscription = ({
  accountId,
  onAccountUpdate,
  enabled = true,
}: UseAccountSubscriptionProps) => {
  const onUpdateRef = useRef(onAccountUpdate);
  const [hasError, setHasError] = useState(false);

  // Update the ref when onAccountUpdate changes
  useEffect(() => {
    onUpdateRef.current = onAccountUpdate;
  }, [onAccountUpdate]);

  // Reset error state when accountId or enabled changes
  useEffect(() => {
    setHasError(false);
  }, [accountId, enabled]);

  // Try to use subscription, but handle errors gracefully
  const { data, loading, error } = useSubscription<AccountSubscriptionData>(
    ACCOUNT_SUBSCRIPTION,
    {
      variables: { accountId },
      skip: !enabled || !accountId,
      onData: ({ data }) => {
        if (data?.data?.accounts_by_pk && onUpdateRef.current) {
          onUpdateRef.current(data.data.accounts_by_pk);
        }
      },
      onError: (error) => {
        console.error('Account subscription error:', error);
        setHasError(true);
      },
    }
  );

  // Handle subscription errors gracefully
  useEffect(() => {
    if (error) {
      console.error('Account subscription failed:', error);
      setHasError(true);
    }
  }, [error]);

  return {
    account: data?.accounts_by_pk || null,
    loading,
    error: hasError ? error : null,
    subscriptionFailed: hasError,
  };
};

export default useAccountSubscription;
