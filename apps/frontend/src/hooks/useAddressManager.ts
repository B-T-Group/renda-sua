import { useCallback, useEffect, useState } from 'react';
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

export type EntityType = 'agent' | 'client' | 'business';

interface AddressManagerConfig {
  entityType: EntityType;
  entityId: string;
  autoFetch?: boolean;
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

// GraphQL mutations for address operations
const INSERT_AGENT_ADDRESS = `
  mutation InsertAgentAddress($agentAddress: agent_addresses_insert_input!) {
    insert_agent_addresses_one(object: $agentAddress) {
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

const INSERT_CLIENT_ADDRESS = `
  mutation InsertClientAddress($clientAddress: client_addresses_insert_input!) {
    insert_client_addresses_one(object: $clientAddress) {
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

const INSERT_BUSINESS_ADDRESS = `
  mutation InsertBusinessAddress($businessAddress: business_addresses_insert_input!) {
    insert_business_addresses_one(object: $businessAddress) {
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
  const { entityType, entityId, autoFetch = true } = config;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // GraphQL hooks
  const { execute: executeAgentQuery } = useGraphQLRequest(GET_AGENT_ADDRESSES);
  const { execute: executeClientQuery } =
    useGraphQLRequest(GET_CLIENT_ADDRESSES);
  const { execute: executeBusinessQuery } = useGraphQLRequest(
    GET_BUSINESS_ADDRESSES
  );

  const { execute: insertAgentAddress } =
    useGraphQLRequest(INSERT_AGENT_ADDRESS);
  const { execute: insertClientAddress } = useGraphQLRequest(
    INSERT_CLIENT_ADDRESS
  );
  const { execute: insertBusinessAddress } = useGraphQLRequest(
    INSERT_BUSINESS_ADDRESS
  );

  const { execute: updateAddress } = useGraphQLRequest(UPDATE_ADDRESS);
  const { execute: deleteAddress } = useGraphQLRequest(DELETE_ADDRESS);

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

  // Get the appropriate mutation executor based on entity type
  const getMutationExecutor = useCallback(() => {
    switch (entityType) {
      case 'agent':
        return insertAgentAddress;
      case 'client':
        return insertClientAddress;
      case 'business':
        return insertBusinessAddress;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }, [
    entityType,
    insertAgentAddress,
    insertClientAddress,
    insertBusinessAddress,
  ]);

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

      const extractedAddresses = addressData.map((item: any) => item.address);
      setAddresses(extractedAddresses);
    } catch (err) {
      console.error('Error fetching addresses:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch addresses'
      );
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, getQueryExecutor]);

  // Add new address
  const addAddress = useCallback(
    async (addressData: AddressFormData) => {
      if (!entityId) {
        throw new Error('Entity ID is required');
      }

      setLoading(true);
      setError(null);
      setSuccessMessage('');

      try {
        const mutationExecutor = getMutationExecutor();

        // Create the nested input structure
        const addressInput = {
          data: {
            ...addressData,
          },
        };

        const entityInput = {
          [`${entityType}_id`]: entityId,
          address: addressInput,
        };

        const variables = {
          [`${entityType}Address`]: entityInput,
        };

        const result = await mutationExecutor(variables);

        if (result[`insert_${entityType}_addresses_one`]) {
          setSuccessMessage('Address added successfully!');
          await fetchAddresses(); // Refresh the list
          return result[`insert_${entityType}_addresses_one`];
        }
      } catch (err) {
        console.error('Error adding address:', err);
        setError(err instanceof Error ? err.message : 'Failed to add address');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [entityId, entityType, getMutationExecutor, fetchAddresses]
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
