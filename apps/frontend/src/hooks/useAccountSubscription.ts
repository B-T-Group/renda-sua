import { gql, useSubscription } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';

// GraphQL subscription for account updates
const ACCOUNT_SUBSCRIPTION = gql`
  subscription OnAccountUpdate($userId: uuid!) {
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
}

interface AccountSubscriptionData {
  accounts: Account[];
}

interface UseAccountSubscriptionProps {
  userId: string;
  onAccountUpdate?: (accounts: Account[]) => void;
  enabled?: boolean;
}

export const useAccountSubscription = ({
  userId,
  onAccountUpdate,
  enabled = true,
}: UseAccountSubscriptionProps) => {
  const onUpdateRef = useRef(onAccountUpdate);
  const [hasError, setHasError] = useState(false);

  // Update the ref when onAccountUpdate changes
  useEffect(() => {
    onUpdateRef.current = onAccountUpdate;
  }, [onAccountUpdate]);

  // Reset error state when userId or enabled changes
  useEffect(() => {
    setHasError(false);
  }, [userId, enabled]);

  // Try to use subscription, but handle errors gracefully
  const { data, loading, error } = useSubscription<AccountSubscriptionData>(
    ACCOUNT_SUBSCRIPTION,
    {
      variables: { userId },
      skip: !enabled || !userId,
      onData: ({ data }) => {
        if (data?.data?.accounts && onUpdateRef.current) {
          onUpdateRef.current(data.data.accounts);
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
    accounts: data?.accounts || [],
    loading,
    error: hasError ? error : null,
    subscriptionFailed: hasError,
  };
};

export default useAccountSubscription;
