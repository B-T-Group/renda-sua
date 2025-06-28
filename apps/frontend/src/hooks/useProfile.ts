import { useState, useEffect } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

// GraphQL Queries and Mutations
const GET_USER_PROFILE = `
  query GetUserProfile {
    users {
      id
      first_name
      last_name
      email
      identifier
      user_type_id
      created_at
      updated_at
    }
    addresses(where: { entity_type: { _eq: "user" } }) {
      id
      entity_type
      entity_id
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
  mutation UpdateUser($id: uuid!, $first_name: String, $last_name: String) {
    update_users_by_pk(
      pk_columns: { id: $id }
      _set: { first_name: $first_name, last_name: $last_name }
    ) {
      id
      first_name
      last_name
      updated_at
    }
  }
`;

const INSERT_ADDRESS = `
  mutation InsertAddress($address: addresses_insert_input!) {
    insert_addresses_one(object: $address) {
      id
      entity_type
      entity_id
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
      updated_at
    }
  }
`;

const INSERT_ACCOUNT = `
  mutation InsertAccount($account: accounts_insert_input!) {
    insert_accounts_one(object: $account) {
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

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  identifier: string;
  user_type_id: string;
  created_at: string;
  updated_at: string;
}

interface Address {
  id: string;
  entity_type: string;
  entity_id: string;
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
  addresses: Address[];
  accounts: Account[];
}

export const useProfile = () => {
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // GraphQL hooks
  const { data, loading, error, execute: fetchProfile, refetch } = useGraphQLRequest<ProfileData>(GET_USER_PROFILE);
  const { execute: updateUser } = useGraphQLRequest(UPDATE_USER);
  const { execute: insertAddress } = useGraphQLRequest(INSERT_ADDRESS);
  const { execute: updateAddress } = useGraphQLRequest(UPDATE_ADDRESS);
  const { execute: insertAccount } = useGraphQLRequest(INSERT_ACCOUNT);

  // Load profile data
  useEffect(() => {
    fetchProfile();
  }, []);

  const handleProfileUpdate = async (userId: string, firstName: string, lastName: string) => {
    try {
      await updateUser({
        id: userId,
        first_name: firstName,
        last_name: lastName,
      });

      setSuccessMessage('Profile updated successfully!');
      refetch();
      return true;
    } catch (error) {
      setErrorMessage('Failed to update profile');
      console.error('Error updating profile:', error);
      return false;
    }
  };

  const handleAddressSave = async (userId: string, addressData: AddressFormData, editingAddressId?: string) => {
    try {
      const addressInput = {
        entity_type: 'user',
        entity_id: userId,
        ...addressData,
      };

      if (editingAddressId) {
        await updateAddress({
          id: editingAddressId,
          address: addressInput,
        });
      } else {
        await insertAddress({
          address: addressInput,
        });
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

  const handleAccountCreate = async (userId: string, userTypeId: string, currency: string) => {
    try {
      // Check if account with this currency already exists
      const existingAccount = data?.accounts.find(
        acc => acc.currency === currency
      );

      if (existingAccount) {
        setErrorMessage('Account with this currency already exists');
        return false;
      }

      await insertAccount({
        account: {
          user_id: userId,
          currency: currency,
          available_balance: 0,
          withheld_balance: 0,
        },
      });

      setSuccessMessage('Account created successfully!');
      refetch();
      return true;
    } catch (error) {
      setErrorMessage('Failed to create account');
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
    addresses: data?.addresses || [],
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