import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

export interface ProjectTransactionItem {
  id: number;
  amount: number;
  currency: string;
  date: string;
  reason?: string;
  type?: string;
  reference?: string;
}

const GET_PROJECT_TRANSACTIONS = gql`
  query projectTransactions($projectId: Int!) {
    projectTransactions(projectId: $projectId) {
      id
      amount
      currency
      date
      reason
      transactionCategory {
        label
        transactionType {
          label
        }
      }
    }
  }
`;

const useProjectTransactions = (projectId?: number) => {
  const [transactions, setTransactions] = useState<ProjectTransactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_PROJECT_TRANSACTIONS, { skip: true });

  useEffect(() => {
    (async () => {
      if (!projectId) return;
      try {
        setLoading(true);
        setError(null);
        const { data } = await refetch({ projectId });
        const list = (data?.projectTransactions ?? []).map((tx: any) => ({
          id: tx.id,
          amount: tx.amount,
          currency: tx.currency,
          date: tx.date,
          reason: tx.reason,
          type: tx.transactionCategory?.transactionType?.label || tx.transactionCategory?.label || 'Transaction',
          reference: tx.reason || `#${tx.id}`,
        }));
        setTransactions(list);
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, refetch]);

  return { loading, transactions, error, refetch };
};

export default useProjectTransactions;





