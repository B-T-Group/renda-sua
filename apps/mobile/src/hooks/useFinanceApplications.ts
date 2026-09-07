import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

export interface FinanceApplicationListItem {
  id: number;
  status?: string;
  createdOn?: string;
  dateCreated?: string;
  applicationType?: string;
  currency?: string;
  amount?: number;
}

const GET_FINANCE_APPLICATIONS = gql`
  query getFinanceApplications($projectId: Int) {
    getFinanceApplications(projectId: $projectId) {
      id
      status
      applicationType
      createdOn
      dateCreated
      project {
        currency
      }
      proposals {
        amount
        currency
      }
    }
  }
`;

const useFinanceApplications = (projectId?: number) => {
  const [items, setItems] = useState<FinanceApplicationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_FINANCE_APPLICATIONS, { skip: true });

  useEffect(() => {
    (async () => {
      if (!projectId) return;
      try {
        setLoading(true);
        setError(null);
        const { data } = await refetch({ projectId });
        const list = (data?.getFinanceApplications ?? []).map((fa: any) => ({
          id: fa.id,
          status: fa.status,
          createdOn: fa.createdOn,
          dateCreated: fa.dateCreated,
          applicationType: fa.applicationType,
          currency: fa.project?.currency || fa.proposals?.[0]?.currency,
          amount: fa.proposals?.[0]?.amount,
        }));
        setItems(list);
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, refetch]);

  return { loading, items, error, refetch };
};

export default useFinanceApplications;





