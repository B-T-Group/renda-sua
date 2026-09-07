import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { gql } from "@apollo/client";

// Types pour les applications de service client
interface ServiceApplication {
  id: number;
  type: string;
  status: string; // ServiceStatus côté API de services
  dateCreated: string;
  amount?: number;
  currency?: string;
  client?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

const GET_CLIENT_SERVICE_APPLICATIONS = gql`
  query getServiceApplications($filter: ServiceApplicationFilter, $pagination: PaginationParams) {
    getServiceApplications(filter: $filter, pagination: $pagination) {
      id
      status
      dateCreated
      service { id name }
      amount: contract { amount }
      currency: contract { currency }
      client { id firstName lastName email }
    }
  }
`;

const useClientServiceApplications = () => {
  const [applications, setApplications] = useState<ServiceApplication[]>([]);
  const [loading, setLoading] = useState(false);

  const { refetch } = useQuery(GET_CLIENT_SERVICE_APPLICATIONS, {
    skip: true,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await refetch({ filter: { clientId: 0 }, pagination: { page: 1, pageSize: 50 } });
        if (data.data.getServiceApplications) {
          const mapped = data.data.getServiceApplications.map((it: any) => ({
            ...it,
            type: it.service?.name,
            amount: it.contract?.amount,
            currency: it.contract?.currency,
          }));
          setApplications(mapped);
        }
      } catch (e) {
        console.log(
          `An error occured while trying to load service applications`,
          e
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { loading, applications };
};

export default useClientServiceApplications;
