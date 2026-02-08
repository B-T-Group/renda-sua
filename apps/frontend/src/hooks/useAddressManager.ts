import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface Address {
  id: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
  address_type: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

export interface AddressFormData {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address_type: string;
  is_primary: boolean;
  latitude?: number;
  longitude?: number;
}

export interface AddressApiResponse {
  success: boolean;
  message: string;
  data: {
    address: Address;
    accountCreated?: {
      message: string;
      account: {
        id: string;
        user_id: string;
        currency: string;
        available_balance: number;
        withheld_balance: number;
        total_balance: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      };
    };
    warning?: string;
  };
}

export interface AddressUpdateResponse {
  success: boolean;
  message: string;
  data: {
    address: Address;
    warning?: string;
  };
}

export interface AddressDeleteResponse {
  success: boolean;
  message: string;
}

export type EntityType = 'agent' | 'client' | 'business';

interface AddressManagerConfig {
  entityType: EntityType;
  entityId: string;
  autoFetch?: boolean;
  onAccountCreated?: (account: any) => void;
}

export interface GetAddressesResponse {
  success: boolean;
  message: string;
  data: {
    addresses: Array<{ address: Address }>;
  };
}

export const useAddressManager = (config: AddressManagerConfig) => {
  const { entityType, entityId, autoFetch = true, onAccountCreated } = config;

  const [addresses, setAddresses] = useState<{ address: Address }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [warning, setWarning] = useState<string | null>(null);

  const apiClient = useApiClient();

  // Fetch addresses via backend REST API (GET /addresses)
  const fetchAddresses = useCallback(async () => {
    if (!entityId) return;

    if (!apiClient) {
      setError('API client not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<GetAddressesResponse>('/addresses');
      const result = response.data;

      if (result.success && result.data?.addresses) {
        const addressData = result.data.addresses.filter(
          (item: { address?: Address }) => item.address
        );
        setAddresses(addressData);
      } else {
        setAddresses([]);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch addresses'
      );
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, apiClient]);

  // Add new address using the new POST API with useApiClient
  const addAddress = useCallback(
    async (addressData: AddressFormData) => {
      if (!entityId) {
        throw new Error('Entity ID is required');
      }

      if (!apiClient) {
        throw new Error('API client not available');
      }

      setLoading(true);
      setError(null);
      setSuccessMessage('');

      try {
        // Prepare the request data for the API
        const requestData = {
          address_line_1: addressData.address_line_1,
          address_line_2: addressData.address_line_2 || undefined,
          city: addressData.city,
          state: addressData.state,
          postal_code: addressData.postal_code,
          country: addressData.country,
          is_primary: addressData.is_primary,
          address_type: addressData.address_type,
          latitude: addressData.latitude,
          longitude: addressData.longitude,
        };

        // Make the API call using useApiClient
        const response = await apiClient.post<AddressApiResponse>(
          '/addresses',
          requestData
        );

        const result = response.data;

        if (result.success) {
          setSuccessMessage(result.message);
          
          // Set warning if present
          if (result.data.warning) {
            setWarning(result.data.warning);
          } else {
            setWarning(null);
          }

          // Refresh the addresses list
          await fetchAddresses();

          // If an account was created, notify the parent component
          if (result.data.accountCreated && onAccountCreated) {
            onAccountCreated(result.data.accountCreated.account);
          }

          return {
            address: result.data.address,
            warning: result.data.warning,
          };
        } else {
          throw new Error(result.message || 'Failed to add address');
        }
      } catch (err: any) {
        console.error('Error adding address:', err);

        // Handle axios error response
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else if (err.message) {
          setError(err.message);
        } else {
          setError('Failed to add address');
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [entityId, apiClient, fetchAddresses, onAccountCreated]
  );

  // Update existing address using REST API
  const updateAddressData = useCallback(
    async (addressId: string, addressData: AddressFormData) => {
      if (!apiClient) {
        throw new Error('API client not available');
      }

      setLoading(true);
      setError(null);
      setSuccessMessage('');
      setWarning(null);

      try {
        // Prepare the request data for the API
        const requestData: Partial<AddressFormData> = {};
        if (addressData.address_line_1 !== undefined) {
          requestData.address_line_1 = addressData.address_line_1;
        }
        if (addressData.address_line_2 !== undefined) {
          requestData.address_line_2 = addressData.address_line_2;
        }
        if (addressData.city !== undefined) {
          requestData.city = addressData.city;
        }
        if (addressData.state !== undefined) {
          requestData.state = addressData.state;
        }
        if (addressData.postal_code !== undefined) {
          requestData.postal_code = addressData.postal_code;
        }
        if (addressData.country !== undefined) {
          requestData.country = addressData.country;
        }
        if (addressData.is_primary !== undefined) {
          requestData.is_primary = addressData.is_primary;
        }
        if (addressData.address_type !== undefined) {
          requestData.address_type = addressData.address_type;
        }
        if (addressData.latitude !== undefined) {
          requestData.latitude = addressData.latitude;
        }
        if (addressData.longitude !== undefined) {
          requestData.longitude = addressData.longitude;
        }

        // Use PATCH for partial update
        const response = await apiClient.patch<AddressUpdateResponse>(
          `/addresses/${addressId}`,
          requestData
        );

        const result = response.data;

        if (result.success) {
          setSuccessMessage(result.message);
          
          // Set warning if present
          if (result.data.warning) {
            setWarning(result.data.warning);
          } else {
            setWarning(null);
          }

          await fetchAddresses(); // Refresh the list
          return {
            address: result.data.address,
            warning: result.data.warning,
          };
        } else {
          throw new Error(result.message || 'Failed to update address');
        }
      } catch (err: any) {
        console.error('Error updating address:', err);
        
        // Handle axios error response
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else if (err.message) {
          setError(err.message);
        } else {
          setError('Failed to update address');
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, fetchAddresses]
  );

  // Delete address using REST API
  const deleteAddressData = useCallback(
    async (addressId: string) => {
      if (!apiClient) {
        throw new Error('API client not available');
      }

      setLoading(true);
      setError(null);
      setSuccessMessage('');
      setWarning(null);

      try {
        const response = await apiClient.delete<AddressDeleteResponse>(
          `/addresses/${addressId}`
        );

        const result = response.data;

        if (result.success) {
          setSuccessMessage(result.message);
          await fetchAddresses(); // Refresh the list
          return { success: true };
        } else {
          throw new Error(result.message || 'Failed to delete address');
        }
      } catch (err: any) {
        console.error('Error deleting address:', err);
        
        // Handle axios error response
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else if (err.message) {
          setError(err.message);
        } else {
          setError('Failed to delete address');
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, fetchAddresses]
  );

  // Clear messages
  const clearMessages = useCallback(() => {
    setSuccessMessage('');
    setError(null);
    setWarning(null);
  }, []);

  // Auto-fetch addresses when component mounts or entityId changes
  useEffect(() => {
    if (autoFetch && entityId) {
      fetchAddresses();
    }
  }, [autoFetch, entityId, fetchAddresses]);

  return {
    // Data
    addresses,

    // State
    loading,
    error,
    successMessage,
    warning,

    // Actions
    fetchAddresses,
    addAddress,
    updateAddress: updateAddressData,
    deleteAddress: deleteAddressData,
    clearMessages,
  };
};
