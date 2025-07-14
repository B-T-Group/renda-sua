import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface CreateAddressDto {
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary?: boolean;
  address_type?: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressResponse {
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

@Injectable()
export class AddressesService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  private async getCurrencyFromCountry(country: string): Promise<string> {
    try {
      const countryToCurrency = await import('country-to-currency');
      const countryCode = country.toUpperCase();
      const currency = (countryToCurrency.default as any)[countryCode];
      if (!currency) {
        // Default to XAF for Cameroon if country not found
        return 'XAF';
      }
      return currency;
    } catch (error) {
      // Default to XAF for Cameroon if any error occurs
      return 'XAF';
    }
  }

  private async getUserInfo(identifier: string) {
    const getUserQuery = `
      query GetUserByIdentifier($identifier: String!) {
        users(where: {identifier: {_eq: $identifier}}) {
          id
          identifier
          user_type_id
          client {
            id
          }
          agent {
            id
          }
          business {
            id
          }
        }
      }
    `;

    const userResult = await this.hasuraUserService.executeQuery(getUserQuery, {
      identifier,
    });

    if (!userResult.users || userResult.users.length === 0) {
      throw new HttpException(
        {
          success: false,
          error: 'User not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    return userResult.users[0];
  }

  private async checkExistingAccount(userId: string, currency: string) {
    const checkExistingAccountQuery = `
      query CheckExistingAccount($userId: uuid!, $currency: currency_enum!) {
        accounts(where: {user_id: {_eq: $userId}, currency: {_eq: $currency}}) {
          id
          currency
        }
      }
    `;

    const existingAccountResult = await this.hasuraUserService.executeQuery(
      checkExistingAccountQuery,
      {
        userId,
        currency,
      }
    );

    return (
      existingAccountResult.accounts &&
      existingAccountResult.accounts.length > 0
    );
  }

  private async createAccount(userId: string, currency: string) {
    const createAccountMutation = `
      mutation CreateAccount(
        $userId: uuid!, 
        $currency: currency_enum!
      ) {
        insert_accounts_one(object: {
          user_id: $userId,
          currency: $currency,
          available_balance: 0,
          withheld_balance: 0,
          is_active: true
        }) {
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

    const result = await this.hasuraSystemService.executeMutation(
      createAccountMutation,
      {
        userId,
        currency,
      }
    );

    return result.insert_accounts_one;
  }

  async createAddress(addressData: CreateAddressDto): Promise<{
    success: boolean;
    address: AddressResponse;
    accountCreated?: any;
  }> {
    try {
      const identifier = this.hasuraUserService.getIdentifier();
      const user = await this.getUserInfo(identifier);

      // Create the address first
      const createAddressMutation = `
        mutation CreateAddress(
          $addressLine1: String!,
          $addressLine2: String,
          $city: String!,
          $state: String!,
          $postalCode: String!,
          $country: String!,
          $isPrimary: Boolean!,
          $addressType: String!,
          $latitude: numeric,
          $longitude: numeric
        ) {
          insert_addresses_one(object: {
            address_line_1: $addressLine1,
            address_line_2: $addressLine2,
            city: $city,
            state: $state,
            postal_code: $postalCode,
            country: $country,
            is_primary: $isPrimary,
            address_type: $addressType,
            latitude: $latitude,
            longitude: $longitude
          }) {
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

      const addressResult = await this.hasuraSystemService.executeMutation(
        createAddressMutation,
        {
          addressLine1: addressData.address_line_1,
          addressLine2: addressData.address_line_2,
          city: addressData.city,
          state: addressData.state,
          postalCode: addressData.postal_code,
          country: addressData.country,
          isPrimary: addressData.is_primary || false,
          addressType: addressData.address_type || 'home',
          latitude: addressData.latitude,
          longitude: addressData.longitude,
        }
      );

      const address = addressResult.insert_addresses_one;

      // Now create the junction table entry based on user type
      let junctionMutation = '';
      let junctionVariables = {};

      if (user.user_type_id === 'client') {
        // Client
        if (!user.client) {
          throw new HttpException(
            {
              success: false,
              error: 'Client record not found for user',
            },
            HttpStatus.BAD_REQUEST
          );
        }
        junctionMutation = `
          mutation CreateClientAddress($clientId: uuid!, $addressId: uuid!) {
            insert_client_addresses_one(object: {
              client_id: $clientId,
              address_id: $addressId
            }) {
              id
              client_id
              address_id
              created_at
              updated_at
            }
          }
        `;
        junctionVariables = {
          clientId: user.client.id,
          addressId: address.id,
        };
      } else if (user.user_type_id === 'business') {
        // Business
        if (!user.business) {
          throw new HttpException(
            {
              success: false,
              error: 'Business record not found for user',
            },
            HttpStatus.BAD_REQUEST
          );
        }
        junctionMutation = `
          mutation CreateBusinessAddress($businessId: uuid!, $addressId: uuid!) {
            insert_business_addresses_one(object: {
              business_id: $businessId,
              address_id: $addressId
            }) {
              id
              business_id
              address_id
              created_at
              updated_at
            }
          }
        `;
        junctionVariables = {
          businessId: user.business.id,
          addressId: address.id,
        };
      } else if (user.user_type_id === 'agent') {
        // Agent
        if (!user.agent) {
          throw new HttpException(
            {
              success: false,
              error: 'Agent record not found for user',
            },
            HttpStatus.BAD_REQUEST
          );
        }
        junctionMutation = `
          mutation CreateAgentAddress($agentId: uuid!, $addressId: uuid!) {
            insert_agent_addresses_one(object: {
              agent_id: $agentId,
              address_id: $addressId
            }) {
              id
              agent_id
              address_id
              created_at
              updated_at
            }
          }
        `;
        junctionVariables = {
          agentId: user.agent.id,
          addressId: address.id,
        };
      }

      if (junctionMutation) {
        await this.hasuraSystemService.executeMutation(
          junctionMutation,
          junctionVariables
        );
      }

      // Get currency from country and create account if needed
      const currency = await this.getCurrencyFromCountry(addressData.country);
      let accountCreated = null;

      const hasExistingAccount = await this.checkExistingAccount(
        user.id,
        currency
      );

      if (!hasExistingAccount) {
        accountCreated = await this.createAccount(user.id, currency);
      }

      return {
        success: true,
        address,
        accountCreated,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Fetch multiple addresses by their IDs
   */
  async getAddressesByIds(addressIds: string[]): Promise<AddressResponse[]> {
    if (!addressIds || addressIds.length === 0) return [];
    const query = `
      query GetAddressesByIds($ids: [uuid!]!) {
        addresses(where: {id: {_in: $ids}}) {
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
    const result = await this.hasuraUserService.executeQuery(query, {
      ids: addressIds,
    });
    return result.addresses || [];
  }

  /**
   * Fetch the current user's primary address (returns null if not found)
   */
  async getCurrentUserPrimaryAddress(): Promise<AddressResponse | null> {
    const identifier = this.hasuraUserService.getIdentifier();
    const user = await this.getUserInfo(identifier);
    let query = '';
    let variables: any = {};
    if (user.user_type_id === 'client' && user.client) {
      query = `
        query GetPrimaryClientAddress($clientId: uuid!) {
          client_addresses(where: {client_id: {_eq: $clientId}, address: {is_primary: {_eq: true}}}) {
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
      variables = { clientId: user.client.id };
    } else if (user.user_type_id === 'business' && user.business) {
      query = `
        query GetPrimaryBusinessAddress($businessId: uuid!) {
          business_addresses(where: {business_id: {_eq: $businessId}, address: {is_primary: {_eq: true}}}) {
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
      variables = { businessId: user.business.id };
    } else if (user.user_type_id === 'agent' && user.agent) {
      query = `
        query GetPrimaryAgentAddress($agentId: uuid!) {
          agent_addresses(where: {agent_id: {_eq: $agentId}, address: {is_primary: {_eq: true}}}) {
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
      variables = { agentId: user.agent.id };
    } else {
      return null;
    }
    const result = await this.hasuraUserService.executeQuery(query, variables);
    const addresses =
      result.client_addresses ||
      result.business_addresses ||
      result.agent_addresses;
    return addresses && addresses.length > 0 ? addresses[0].address : null;
  }
}
