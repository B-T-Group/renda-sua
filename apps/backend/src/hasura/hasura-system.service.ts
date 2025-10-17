import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';
import {
  Addresses,
  GetAccountByIdQuery,
  GetUserAccountQuery,
  GetUserAgentQuery,
  GetUserBusinessQuery,
  GetUserByIdQuery,
  GetUserClientQuery,
} from '../generated/graphql';
import {
  GET_ACCOUNT_BY_ID,
  GET_USER_ACCOUNT,
  GET_USER_AGENT,
  GET_USER_BUSINESS,
  GET_USER_BY_ID,
  GET_USER_CLIENT,
} from './hasura.queries';

@Injectable()
export class HasuraSystemService {
  private readonly hasuraUrl: string;
  private readonly adminSecret: string;
  private readonly client: GraphQLClient;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get('hasura');

    this.hasuraUrl = config.endpoint || 'http://localhost:8080/v1/graphql';
    this.adminSecret = config.adminSecret || 'myadminsecretkey';

    this.client = new GraphQLClient(this.hasuraUrl, {
      headers: {
        'x-hasura-admin-secret': this.adminSecret,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Creates a GraphQL client with admin secret for system operations
   */
  createClient(): any {
    return new GraphQLClient(this.hasuraUrl, {
      headers: {
        'x-hasura-admin-secret': this.adminSecret,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute a GraphQL query with admin privileges
   */
  async executeQuery<T = any>(query: string, variables?: any): Promise<T> {
    return this.client.request<T>(query, variables);
  }

  /**
   * Execute a GraphQL mutation with admin privileges
   */
  async executeMutation<T = any>(
    mutation: string,
    variables?: any
  ): Promise<T> {
    return this.client.request<T>(mutation, variables);
  }

  /**
   * Create a user account for a given user and currency
   */
  async createUserAccount(
    userId: string,
    currency: string,
    available_balance = 0,
    withheld_balance = 0
  ): Promise<any> {
    const mutation = `
      mutation CreateUserAccount($userId: uuid!, $currency: currency_enum!, $available_balance: numeric!, $withheld_balance: numeric!) {
        insert_accounts_one(object: {
          user_id: $userId,
          currency: $currency,
          available_balance: $available_balance,
          withheld_balance: $withheld_balance
        }) {
          id
          user_id
          currency
          available_balance
          withheld_balance
        }
      }
    `;
    const result = await this.executeMutation(mutation, {
      userId,
      currency,
      available_balance,
      withheld_balance,
    });
    return result.insert_accounts_one;
  }

  /**
   * Get the Hasura endpoint URL
   */
  getHasuraUrl(): string {
    return this.hasuraUrl;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.hasuraUrl && this.adminSecret);
  }

  /**
   * Get the client user using HasuraSystemService (create method if not exists)
   * We'll assume a method getUserById exists or add it to HasuraSystemService if not.
   * Usage:   const clientUser = await this.hasuraSystemService.getUserById(clientUserId);
   * If not present, you should add this to HasuraSystemService:
   */
  async getUserById(userId: string) {
    const result = await this.executeQuery<GetUserByIdQuery>(GET_USER_BY_ID, {
      userId,
    });
    return result.users_by_pk;
  }

  /**
   * Get client by user ID
   */
  async getClient(id: string): Promise<any> {
    const query = `
      query ($id: uuid!) {
        clients(where: { id: { _eq: $id } }) {
          id
          user_id
        }
      }
    `;
    const result = await this.executeQuery(query, { id });
    return result.clients[0] || null;
  }

  /**
   * Get business by user ID
   */
  async getBusiness(id: string): Promise<any> {
    const query = `
      query ($id: uuid!) {
        businesses(where: { id: { _eq: $id } }) {
          id
          user_id
          name
          is_admin
          is_verified
        }
      }
    `;
    const result = await this.executeQuery(query, { id });
    return result.businesses[0] || null;
  }

  /**
   * Get agent by user ID
   */
  async getAgent(id: string): Promise<any> {
    const query = `
      query ($id: uuid!) {
        agents(where: { id: { _eq: $id } }) {
          id
          user_id
          vehicle_type_id
          is_verified
        }
      }
    `;
    const result = await this.executeQuery(query, { id });
    return result.agents[0] || null;
  }

  /**
   * Get user account by userId and currency
   */
  async getAccount(userId: string, currency: string) {
    const result = await this.executeQuery<GetUserAccountQuery>(
      GET_USER_ACCOUNT,
      {
        userId,
        currency,
      }
    );
    let account = result.accounts[0] || null;
    if (!account) {
      // Create the account if it doesn't exist
      account = await this.createUserAccount(userId, currency);
    }
    return account;
  }

  /**
   * Get account by ID
   */
  async getAccountById(accountId: string) {
    const result = await this.executeQuery<GetAccountByIdQuery>(
      GET_ACCOUNT_BY_ID,
      {
        accountId,
      }
    );

    return result.accounts_by_pk;
  }

  /**
   * Update user account balances
   */
  async updateUserAccount(
    accountId: string,
    updates: {
      available_balance?: number;
      withheld_balance?: number;
    },
    operation: 'set' | 'inc' = 'set'
  ): Promise<any> {
    const mutation = `
      mutation UpdateUserAccount(
        $accountId: uuid!,
        $availableBalance: numeric,
        $withheldBalance: numeric
      ) {
        update_accounts_by_pk(
          pk_columns: { id: $accountId },
          ${operation === 'inc' ? '_inc' : '_set'}: {
            available_balance: $availableBalance,
            withheld_balance: $withheldBalance
          }
        ) {
          id
          available_balance
          withheld_balance
          total_balance
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      accountId,
      availableBalance: updates.available_balance,
      withheldBalance: updates.withheld_balance,
    });

    return result.update_accounts_by_pk;
  }

  /**
   * Get delivery fee for a specific currency
   * Returns the delivery fee amount or 0 if no fee is found for the currency
   */
  async getDeliveryFee(currency: string): Promise<number> {
    const query = `
      query GetDeliveryFee($currency: currency_enum!) {
        delivery_fees(where: { currency: { _eq: $currency } }, limit: 1) {
          fee
        }
      }
    `;

    try {
      const result = await this.executeQuery(query, { currency });
      const deliveryFee = result.delivery_fees[0];
      return deliveryFee ? deliveryFee.fee : 0;
    } catch (error) {
      console.error(
        `Error fetching delivery fee for currency ${currency}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Get user client by user ID
   */
  async getUserClient(userId: string) {
    const clientResult = await this.executeQuery<GetUserClientQuery>(
      GET_USER_CLIENT,
      {
        userId,
      }
    );

    return clientResult.clients[0];
  }

  /**
   * Get user business by user ID
   */
  async getUserBusiness(userId: string) {
    const businessResult = await this.executeQuery<GetUserBusinessQuery>(
      GET_USER_BUSINESS,
      {
        userId,
      }
    );
    return businessResult.businesses[0];
  }

  /**
   * Get user agent by user ID
   */
  async getUserAgent(userId: string) {
    const agentResult = await this.executeQuery<GetUserAgentQuery>(
      GET_USER_AGENT,
      {
        userId,
      }
    );
    return agentResult.agents[0];
  }

  /**
   * Get all user addresses by user ID and user type
   */
  async getAllUserAddresses(
    userId: string,
    userType: string
  ): Promise<(Addresses & { formatted_address: string })[]> {
    let query: string;

    switch (userType) {
      case 'client':
        query = `
          query GetAllClientAddresses($userId: uuid!) {
            client_addresses(where: {client: {user_id: {_eq: $userId}}}) {
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
                updated_at
              }
            }
          }
        `;
        break;
      case 'agent':
        query = `
          query GetAllAgentAddresses($userId: uuid!) {
            agent_addresses(where: {agent: {user_id: {_eq: $userId}}}) {
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
                updated_at
              }
            }
          }
        `;
        break;
      case 'business':
        query = `
          query GetAllBusinessAddresses($userId: uuid!) {
            business_addresses(where: {business: {user_id: {_eq: $userId}}}) {
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
                updated_at
              }
            }
          }
        `;
        break;
      default:
        throw new Error('Invalid user type');
    }

    const addressResult = await this.executeQuery(query, {
      userId,
    });

    const addresses =
      addressResult.client_addresses ||
      addressResult.agent_addresses ||
      addressResult.business_addresses;

    return (
      addresses
        ?.map((item: any) => {
          const address = item.address;
          if (!address) return null;

          // Create formatted address by combining address fields
          const addressParts = [
            address.address_line_1,
            address.address_line_2,
            address.city,
            address.state,
            address.postal_code,
            address.country,
          ].filter((part) => part && part.trim() !== '');

          return {
            ...address,
            formatted_address: addressParts.join(', '),
          };
        })
        .filter(Boolean) || []
    );
  }
}
