import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useGraphQLRequest } from './useGraphQLRequest';

// GraphQL Queries and Mutations
const GET_USER_PROFILE = `
  query GetUserProfile {
    users {
      id
      first_name
      last_name
      email
      phone_number
      identifier
      user_type_id
      created_at
      updated_at
    }
    accounts {
      id
      user_id
      currency
      available_balance
      withheld_balance
      total_balance
      is_active
      created_at
      updated_at
    }
  }
`;

const UPDATE_USER = `
  mutation UpdateUser($id: uuid!, $first_name: String!, $last_name: String!, $phone_number: String) {
    update_users_by_pk(
      pk_columns: { id: $id }
      _set: { first_name: $first_name, last_name: $last_name, phone_number: $phone_number }
    ) {
      id
      first_name
      last_name
      email
      phone_number
      identifier
      user_type_id
      created_at
      updated_at
    }
  }
`;

// New mutations for address management through junction tables
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

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  identifier: string;
  user_type_id: string;
  created_at: string;
  updated_at: string;
}

interface Address {
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

interface Account {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  total_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AddressFormData {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address_type: string;
  is_primary: boolean;
}

interface ProfileData {
  users: UserProfile[];
  accounts: Account[];
}

export const useProfile = (onProfileUpdate?: () => void) => {
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // GraphQL hooks
  const {
    data,
    loading,
    error,
    execute: fetchProfile,
    refetch,
  } = useGraphQLRequest<ProfileData>(GET_USER_PROFILE);
  const { execute: updateUser } = useGraphQLRequest(UPDATE_USER);
  const { execute: insertAgentAddress } =
    useGraphQLRequest(INSERT_AGENT_ADDRESS);
  const { execute: insertClientAddress } = useGraphQLRequest(
    INSERT_CLIENT_ADDRESS
  );
  const { execute: insertBusinessAddress } = useGraphQLRequest(
    INSERT_BUSINESS_ADDRESS
  );
  const { execute: updateAddress } = useGraphQLRequest(UPDATE_ADDRESS);

  // API client for backend calls
  const apiClient = useApiClient();

  // Load profile data
  useEffect(() => {
    fetchProfile();
  }, []);

  const handleProfileUpdate = async (
    userId: string,
    firstName: string,
    lastName: string,
    phoneNumber: string
  ) => {
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const variables = {
        id: userId,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
      };

      const result = await updateUser(variables);

      if (result?.update_users_by_pk) {
        setSuccessMessage('Profile updated successfully!');
        refetch(); // Refresh the profile data

        // Also refresh the UserProfileContext if callback is provided
        if (onProfileUpdate) {
          onProfileUpdate();
        }

        return true;
      } else {
        setErrorMessage('Failed to update profile.');
        return false;
      }
    } catch (err: any) {
      setErrorMessage('Failed to update profile.');
      console.error('Error updating profile:', err);
      return false;
    }
  };

  const handleAddressSave = async (
    userId: string,
    addressData: AddressFormData,
    editingAddressId?: string,
    userType?: string,
    profileId?: string
  ) => {
    try {
      if (editingAddressId) {
        // Update existing address
        await updateAddress({
          id: editingAddressId,
          address: addressData,
        });
      } else {
        // Insert new address through appropriate junction table
        const addressInput = {
          data: {
            ...addressData,
          },
        };

        // Use the correct profile ID (client_id, agent_id, or business_id)
        const correctId = profileId || userId;

        switch (userType) {
          case 'agent':
            await insertAgentAddress({
              agentAddress: {
                agent_id: correctId,
                address: addressInput,
              },
            });
            break;
          case 'client':
            await insertClientAddress({
              clientAddress: {
                client_id: correctId,
                address: addressInput,
              },
            });
            break;
          case 'business':
            await insertBusinessAddress({
              businessAddress: {
                business_id: correctId,
                address: addressInput,
              },
            });
            break;
          default:
            throw new Error('Invalid user type for address creation');
        }
      }

      setSuccessMessage('Address saved successfully!');
      refetch();
      return true;
    } catch (error) {
      setErrorMessage('Failed to save address');
      console.error('Error saving address:', error);
      return false;
    }
  };

  const handleAccountCreate = async (
    userId: string,
    userTypeId: string,
    currency: string
  ) => {
    try {
      if (!apiClient) {
        setErrorMessage('API client not available');
        return false;
      }

      // Check if account with this currency already exists
      const existingAccount = data?.accounts.find(
        (acc) => acc.currency === currency
      );

      if (existingAccount) {
        setErrorMessage('Account with this currency already exists');
        return false;
      }

      // Use backend API to create account
      const response = await apiClient.post('/accounts', {
        currency: currency,
      });

      if (response.data.success) {
        setSuccessMessage('Account created successfully!');
        refetch();
        return true;
      } else {
        setErrorMessage(response.data.error || 'Failed to create account');
        return false;
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        setErrorMessage('Account with this currency already exists');
      } else {
        setErrorMessage('Failed to create account');
      }
      console.error('Error creating account:', error);
      return false;
    }
  };

  const clearMessages = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  return {
    // Data
    userProfile: data?.users?.[0],
    accounts: data?.accounts || [],

    // Loading and error states
    loading,
    error,

    // Messages
    successMessage,
    errorMessage,

    // Actions
    handleProfileUpdate,
    handleAddressSave,
    handleAccountCreate,
    clearMessages,
    refetch,
  };
};
