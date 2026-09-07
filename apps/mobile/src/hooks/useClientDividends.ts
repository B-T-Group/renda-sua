import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { gql } from "@apollo/client";

// Types pour les dividendes client
interface ClientDividend {
  id: number;
  amount: number;
  currency: string;
  dateCreated: string;
  status: string;
  // Ajoutez d'autres champs selon vos besoins
}

const GET_CLIENT_DIVIDENDS = gql`
  query GetClientDividends {
    getClientDividends {
      id
      amount
      currency
      dateCreated
      status
    }
  }
`;

const useClientDividends = () => {
  const [dividends, setDividends] = useState<ClientDividend[]>([]);
  const [loading, setLoading] = useState(false);

  const { refetch } = useQuery(GET_CLIENT_DIVIDENDS, {
    skip: true,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await refetch({});
        if (data.data.getClientDividends) {
          setDividends(data.data.getClientDividends);
        }
      } catch (e) {
        console.log(
          `An error occured while trying to load client dividends`,
          e
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { loading, dividends };
};

export default useClientDividends;

