import { useQuery, gql } from '@apollo/client';
import { useEffect, useMemo, useState } from 'react';

interface ClientShareItemRaw {
  shares: number;
  project: {
    valuation: {
      currency: string;
      valuation: number;
      sharePrice: number;
    };
    projectInformation: {
      title: string;
    };
  };
}

export interface ClientShareItem {
  shares: number;
  project: {
    name: string;
    currency: string;
    valuation: number;
    sharePrice: number;
  };
  totalValue: number;
}

// Aligné sur le hook web (core/hooks/useClientShares.ts)
const GET_CLIENT_SHARES = gql`
  query getClient($id: Int!) {
    getClient(id: $id) {
      shares {
        shares
        project {
          valuation {
            valuation
            currency
            sharePrice
          }
          projectInformation {
            title
          }
        }
        client {
          email
          firstName
          lastName
        }
      }
    }
  }
`;

export const useClientShares = (clientId?: number) => {
  const [shares, setShares] = useState<ClientShareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_CLIENT_SHARES, { skip: true });

  useEffect(() => {
    (async () => {
      if (!clientId) return;
      try {
        setLoading(true);
        setError(null);
        const { data } = await refetch({ id: clientId });
        const list: ClientShareItemRaw[] = data?.getClient?.shares ?? [];
        const mapped = list.map((item) => {
          const currency = item.project.valuation.currency;
          const sharePrice = item.project.valuation.sharePrice;
          const totalValue = (item.shares || 0) * (sharePrice || 0);
          return {
            shares: item.shares,
            project: {
              name: item.project.projectInformation.title,
              currency,
              valuation: item.project.valuation.valuation,
              sharePrice,
            },
            totalValue,
          } as ClientShareItem;
        });
        setShares(mapped);
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, refetch]);

  const totals = useMemo(() => {
    return shares.reduce((acc, s) => acc + s.totalValue, 0);
  }, [shares]);

  return { loading, shares, totals, error, refetch };
};

export default useClientShares;





