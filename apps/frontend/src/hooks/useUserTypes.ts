import { useState, useEffect } from 'react';
import { useApiClient } from './useApiClient';

export interface UserType {
  id: string;
  comment: string;
}

export interface VehicleType {
  id: string;
  comment: string;
}

export const useUserTypes = () => {
  const apiClient = useApiClient();
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!apiClient) {
        setError('API client not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch user types
        const userTypesResponse = await apiClient.get('/user_types');
        if (userTypesResponse.data.success) {
          setUserTypes(userTypesResponse.data.user_types);
        }

        // Fetch vehicle types
        const vehicleTypesResponse = await apiClient.get('/vehicle_types');
        if (vehicleTypesResponse.data.success) {
          setVehicleTypes(vehicleTypesResponse.data.vehicle_types);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiClient]);

  return {
    userTypes,
    vehicleTypes,
    loading,
    error,
  };
}; 