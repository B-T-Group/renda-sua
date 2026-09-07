import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { gql } from "@apollo/client";

// Types pour les balances - Exactement comme sur le web
interface Balance {
  id: number;
  balance: number;
  currency: string;
  type: string;
  agencyId: number;
  withdrawals?: {
    amount: number;
    currency: string;
    request: {
      status: string;
    };
  }[];
}

const GET_BALANCES = gql`
  query balances($uuid: String) {
    balances(uuid: $uuid) {
      currency
      id
      balance
      agencyId
      type
      withdrawals {
        amount
        currency
        request {
          status
        }
      }
    }
  }
`;

const useBalances = (uuid?: string) => {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);

  const { refetch } = useQuery(GET_BALANCES, {
    skip: true,
  });

  const reload = async (uuid?: string) => {
    setLoading(true);
    try {
      const data = await refetch({ uuid });
      if (data.data?.balances) {
        setBalances(data.data.balances);
      }
    } catch (e) {
      console.log(
        `An error occurred while trying to load balances`,
        e
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await reload(uuid);
    })();
  }, [uuid]);

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  return { loading, balances, reload };
};

export default useBalances;
