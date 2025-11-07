import { gql } from 'graphql-request';

// Query for getting user by identifier
export const GET_USER_BY_IDENTIFIER = gql`
  query GetUserByIdentifier($identifier: String!) {
    users(where: { identifier: { _eq: $identifier } }) {
      id
      identifier
      email
      first_name
      last_name
      phone_number
      phone_number_verified
      email_verified
      user_type_id
      created_at
      updated_at
    }
  }
`;

// Consolidated query for getting user by identifier with all related data (client/agent/business)
// Note: Addresses are fetched separately to avoid relationship access issues
export const GET_USER_BY_IDENTIFIER_WITH_RELATIONS = gql`
  query GetUserByIdentifierWithRelations($identifier: String!) {
    users(where: { identifier: { _eq: $identifier } }) {
      id
      identifier
      email
      first_name
      last_name
      phone_number
      phone_number_verified
      email_verified
      user_type_id
      created_at
      updated_at
      client {
        id
        user_id
        created_at
        updated_at
      }
      agent {
        id
        user_id
        vehicle_type_id
        is_verified
        created_at
        updated_at
      }
      business {
        id
        user_id
        name
        is_admin
        is_verified
        created_at
        updated_at
      }
    }
  }
`;

// Query for getting user by ID
export const GET_USER_BY_ID = gql`
  query GetUserById($userId: uuid!) {
    users_by_pk(id: $userId) {
      id
      email
      first_name
      last_name
      agent {
        id
      }
      client {
        id
      }
      business {
        id
      }
      user_type_id
      created_at
      updated_at
    }
  }
`;

// Query for getting user account
export const GET_USER_ACCOUNT = gql`
  query GetUserAccount($userId: uuid!, $currency: currency_enum!) {
    accounts(
      where: {
        user_id: { _eq: $userId }
        currency: { _eq: $currency }
        is_active: { _eq: true }
      }
    ) {
      id
      available_balance
      withheld_balance
    }
  }
`;

// Query for getting account by ID
export const GET_ACCOUNT_BY_ID = gql`
  query GetAccountById($accountId: uuid!) {
    accounts_by_pk(id: $accountId) {
      id
      user_id
      currency
      available_balance
      withheld_balance
      is_active
      created_at
      updated_at
    }
  }
`;

// Query for getting user client record
export const GET_USER_CLIENT = gql`
  query GetUserClient($userId: uuid!) {
    clients(where: { user_id: { _eq: $userId } }) {
      id
      user_id
      client_addresses {
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
          created_at
        }
      }
      created_at
      updated_at
    }
  }
`;

// Query for getting user business record
export const GET_USER_BUSINESS = gql`
  query GetUserBusiness($userId: uuid!) {
    businesses(where: { user_id: { _eq: $userId } }) {
      id
      user_id
      name
      is_admin
      is_verified
      business_addresses {
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
          created_at
        }
      }
      created_at
      updated_at
    }
  }
`;

// Query for getting user agent record
export const GET_USER_AGENT = gql`
  query GetUserAgent($userId: uuid!) {
    agents(where: { user_id: { _eq: $userId } }) {
      id
      user_id
      vehicle_type_id
      is_verified
      agent_addresses {
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
          created_at
        }
      }
      created_at
      updated_at
    }
  }
`;

// Query for getting client by ID
export const GET_CLIENT_BY_ID = gql`
  query GetClientById($id: uuid!) {
    clients(where: { id: { _eq: $id } }) {
      id
      user_id
    }
  }
`;

// Query for getting business by ID
export const GET_BUSINESS_BY_ID = gql`
  query GetBusinessById($id: uuid!) {
    businesses(where: { id: { _eq: $id } }) {
      id
      user_id
      name
      is_admin
      is_verified
    }
  }
`;

// Query for getting agent by ID
export const GET_AGENT_BY_ID = gql`
  query GetAgentById($id: uuid!) {
    agents(where: { id: { _eq: $id } }) {
      id
      user_id
      vehicle_type_id
      is_verified
    }
  }
`;

// Query for getting agent addresses
export const GET_AGENT_ADDRESSES = gql`
  query GetAgentAddresses($agentId: uuid!) {
    addresses(where: { agent_addresses: { agent_id: { _eq: $agentId } } }) {
      id
      address_line_1
      address_line_2
      city
      state
      postal_code
      country
      is_primary
      address_type
      created_at
      updated_at
    }
  }
`;

// Query for getting client addresses
export const GET_CLIENT_ADDRESSES = gql`
  query GetClientAddresses($clientId: uuid!) {
    addresses(where: { client_addresses: { client_id: { _eq: $clientId } } }) {
      id
      address_line_1
      address_line_2
      city
      state
      postal_code
      country
      is_primary
      address_type
      created_at
      updated_at
    }
  }
`;

// Query for getting business addresses
export const GET_BUSINESS_ADDRESSES = gql`
  query GetBusinessAddresses($businessId: uuid!) {
    addresses(
      where: { business_addresses: { business_id: { _eq: $businessId } } }
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
      created_at
      updated_at
    }
  }
`;

// Query for getting address by ID
export const GET_ADDRESS_BY_ID = gql`
  query GetAddressById($addressId: uuid!) {
    addresses_by_pk(id: $addressId) {
      id
      address_line_1
      address_line_2
      city
      state
      postal_code
      country
      is_primary
      address_type
      created_at
      updated_at
    }
  }
`;

// Mutation to create user account
export const CREATE_USER_ACCOUNT = gql`
  mutation CreateUserAccount($userId: uuid!, $currency: currency_enum!) {
    insert_accounts_one(
      object: {
        user_id: $userId
        currency: $currency
        available_balance: 0
        withheld_balance: 0
        is_active: true
      }
    ) {
      id
      user_id
      currency
      available_balance
      withheld_balance
      is_active
      created_at
    }
  }
`;

// Mutation to update account balance
export const UPDATE_ACCOUNT_BALANCE = gql`
  mutation UpdateAccountBalance(
    $accountId: uuid!
    $availableBalance: numeric!
    $withheldBalance: numeric!
  ) {
    update_accounts_by_pk(
      pk_columns: { id: $accountId }
      _set: {
        available_balance: $availableBalance
        withheld_balance: $withheldBalance
        updated_at: "now()"
      }
    ) {
      id
      available_balance
      withheld_balance
      updated_at
    }
  }
`;
