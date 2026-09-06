import { useQuery, gql } from '@apollo/client';
import { useState, useEffect } from 'react';

const AGENCIES_QUERY = gql`
  query Agencies {
    agencies {
      id
      name
      email
      isHeadOffice
      address {
        address
        city
        state
        country
        postCode
        phoneNumber
      }
    }
  }
`;

const useAgencies = () => {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { data, loading: queryLoading, refetch } = useQuery(AGENCIES_QUERY);

  useEffect(() => {
    if (data?.agencies) {
      setAgencies(data.agencies);
      setLoading(false);
    }
  }, [data]);

  const reload = async () => {
    setLoading(true);
    const result = await refetch();
    if (result.data?.agencies) {
      setAgencies(result.data.agencies);
    }
    setLoading(false);
  };

  return { loading: loading || queryLoading, agencies, reload };
};

export default useAgencies;

