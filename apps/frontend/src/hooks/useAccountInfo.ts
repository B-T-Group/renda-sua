import { useEffect, useRef } from 'react';
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

export interface Account {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  total_balance: number;
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