import { useEffect, useMemo, useState } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

export interface VehicleType {
  id: string;
  comment: string;
}

const GET_VEHICLE_TYPES = `
  query GetVehicleTypes {
    vehicle_types(order_by: { id: asc }) {
      id
      comment
    }
  }
`;

export const useVehicleTypes = () => {
  const { data, loading, error, execute, refetch } = useGraphQLRequest<{
    vehicle_types: VehicleType[];
  }>(GET_VEHICLE_TYPES);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      setTimeout(() => execute(), 0);
    }
  }, [initialized, execute]);

  const vehicleTypes = useMemo(() => data?.vehicle_types || [], [data]);

  return { vehicleTypes, loading, error, refetch };
};
