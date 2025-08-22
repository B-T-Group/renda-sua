import { gql, useApolloClient, useSubscription } from '@apollo/client';
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

// GraphQL query for fetching accounts (fallback)
const GET_ACCOUNTS_QUERY = gql`
  query GetAccounts($userId: uuid!) {
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
  const [subscriptionFailed, setSubscriptionFailed] = useState(false);
  const apolloClient = useApolloClient();

  // Update the ref when onAccountUpdate changes
  useEffect(() => {
    onUpdateRef.current = onAccountUpdate;
  }, [onAccountUpdate]);

  // Reset error state when userId or enabled changes
  useEffect(() => {
    setHasError(false);
    setSubscriptionFailed(false);
  }, [userId, enabled]);

  // Fallback polling mechanism when subscription fails
  useEffect(() => {
    if (subscriptionFailed && enabled && userId && apolloClient) {
      const pollInterval = setInterval(async () => {
        try {
          const result = await apolloClient.query({
            query: GET_ACCOUNTS_QUERY,
            variables: { userId },
            fetchPolicy: 'network-only',
          });

          if (result.data?.accounts && onUpdateRef.current) {
            onUpdateRef.current(result.data.accounts);
          }
        } catch (error) {
          console.error('Polling query failed:', error);
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(pollInterval);
    }
  }, [subscriptionFailed, enabled, userId, apolloClient]);

  const { data, loading, error } = useSubscription<AccountSubscriptionData>(
    ACCOUNT_SUBSCRIPTION,
    {
      variables: { userId },
      skip: !enabled || !userId || subscriptionFailed,
      onData: ({ data }) => {
        if (data?.data?.accounts && onUpdateRef.current) {
          onUpdateRef.current(data.data.accounts);
        }
      },
      onError: (error) => {
        console.error('Account subscription error:', error);
        setHasError(true);
        setSubscriptionFailed(true);
      },
    }
  );

  // Handle subscription errors gracefully
  useEffect(() => {
    if (error) {
      console.error('Account subscription failed:', error);
      setHasError(true);
      setSubscriptionFailed(true);
    }
  }, [error]);

  return {
    accounts: data?.accounts || [],
    loading,
    error: hasError ? error : null,
    subscriptionFailed,
  };
};

export default useAccountSubscription;
