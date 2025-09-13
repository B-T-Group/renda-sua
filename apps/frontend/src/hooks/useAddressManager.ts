import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useGraphQLRequest } from './useGraphQLRequest';

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
  };
}

export type EntityType = 'agent' | 'client' | 'business';

interface AddressManagerConfig {
  entityType: EntityType;
  entityId: string;
  autoFetch?: boolean;
  onAccountCreated?: (account: any) => void;
}

// GraphQL queries for fetching addresses
const GET_AGENT_ADDRESSES = `
  query GetAgentAddresses($agentId: uuid!) {
    agent_addresses(where: { agent_id: { _eq: $agentId } }) {
      id
      agent_id
      address_id
      created_at
      updated_at
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
        is_primary
        address_type
        latitude
        longitude
        created_at
        updated_at
      }
    }
  }
`;

const GET_CLIENT_ADDRESSES = `
  query GetClientAddresses($clientId: uuid!) {
    client_addresses(where: { client_id: { _eq: $clientId } }) {
      id
      client_id
      address_id
      created_at
      updated_at
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
        is_primary
        address_type
        latitude
        longitude
        created_at
        updated_at
      }
    }
  }
`;

const GET_BUSINESS_ADDRESSES = `
  query GetBusinessAddresses($businessId: uuid!) {
    business_addresses(where: { business_id: { _eq: $businessId } }) {
      id
      business_id
      address_id
      created_at
      updated_at
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
        is_primary
        address_type
        latitude
        longitude
        created_at
        updated_at
      }
    }
  }
`;

const UPDATE_ADDRESS = `
  mutation UpdateAddress($id: uuid!, $address: addresses_set_input!) {
    update_addresses_by_pk(
      pk_columns: { id: $id }
      _set: $address
    ) {
      id
      address_line_1
      address_line_2
      city
      state
      postal_code
      country
      is_primary
      address_type
      latitude
      longitude
      created_at
      updated_at
    }
  }
`;

const DELETE_ADDRESS = `
  mutation DeleteAddress($id: uuid!) {
    delete_addresses_by_pk(id: $id) {
      id
    }
  }
`;

export const useAddressManager = (config: AddressManagerConfig) => {
  const { entityType, entityId, autoFetch = true, onAccountCreated } = config;

  const [addresses, setAddresses] = useState<{ address: Address }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // GraphQL hooks for fetching and other operations
  const { execute: executeAgentQuery } = useGraphQLRequest(GET_AGENT_ADDRESSES);
  const { execute: executeClientQuery } =
    useGraphQLRequest(GET_CLIENT_ADDRESSES);
  const { execute: executeBusinessQuery } = useGraphQLRequest(
    GET_BUSINESS_ADDRESSES
  );

  const { execute: updateAddress } = useGraphQLRequest(UPDATE_ADDRESS);
  const { execute: deleteAddress } = useGraphQLRequest(DELETE_ADDRESS);

  // API client for backend requests
  const apiClient = useApiClient();

  // Get the appropriate query based on entity type
  const getQueryExecutor = useCallback(() => {
    switch (entityType) {
      case 'agent':
        return executeAgentQuery;
      case 'client':
        return executeClientQuery;
      case 'business':
        return executeBusinessQuery;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }, [entityType, executeAgentQuery, executeClientQuery, executeBusinessQuery]);

  // Fetch addresses
  const fetchAddresses = useCallback(async () => {
    if (!entityId) return;

    setLoading(true);
    setError(null);

    try {
      const queryExecutor = getQueryExecutor();
      const variables = {
        [`${entityType}Id`]: entityId,
      };

      const result = await queryExecutor(variables);

      // Extract addresses from the result
      const addressKey = `${entityType}_addresses`;
      const addressData = result[addressKey] || [];

      // Extract the nested address objects from the junction table
      const addresses = addressData
        .map((item: any) => item.address)
        .filter(Boolean);

      setAddresses(addresses);
    } catch (err) {
      console.error('Error fetching addresses:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch addresses'
      );
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, getQueryExecutor]);

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

          // Refresh the addresses list
          await fetchAddresses();

          // If an account was created, notify the parent component
          if (result.data.accountCreated && onAccountCreated) {
            onAccountCreated(result.data.accountCreated.account);
          }

          return result.data.address;
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

  // Update existing address
  const updateAddressData = useCallback(
    async (addressId: string, addressData: AddressFormData) => {
      setLoading(true);
      setError(null);
      setSuccessMessage('');

      try {
        const result = await updateAddress({
          id: addressId,
          address: addressData,
        });

        if (result.update_addresses_by_pk) {
          setSuccessMessage('Address updated successfully!');
          await fetchAddresses(); // Refresh the list
          return result.update_addresses_by_pk;
        }
      } catch (err) {
        console.error('Error updating address:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to update address'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [updateAddress, fetchAddresses]
  );

  // Delete address
  const deleteAddressData = useCallback(
    async (addressId: string) => {
      setLoading(true);
      setError(null);
      setSuccessMessage('');

      try {
        const result = await deleteAddress({
          id: addressId,
        });

        if (result.delete_addresses_by_pk) {
          setSuccessMessage('Address deleted successfully!');
          await fetchAddresses(); // Refresh the list
          return result.delete_addresses_by_pk;
        }
      } catch (err) {
        console.error('Error deleting address:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to delete address'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [deleteAddress, fetchAddresses]
  );

  // Clear messages
  const clearMessages = useCallback(() => {
    setSuccessMessage('');
    setError(null);
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

    // Actions
    fetchAddresses,
    addAddress,
    updateAddress: updateAddressData,
    deleteAddress: deleteAddressData,
    clearMessages,
  };
};
