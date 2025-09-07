import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';

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
  async executeQuery(query: string, variables?: any): Promise<any> {
    return this.client.request(query, variables);
  }

  /**
   * Execute a GraphQL mutation with admin privileges
   */
  async executeMutation(mutation: string, variables?: any): Promise<any> {
    return this.client.request(mutation, variables);
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
    const query = `
         query ($userId: uuid!) {
           users_by_pk(id: $userId) {
             id
             email
             name
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
    const result = await this.executeQuery(query, { userId });
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
  async getAccount(userId: string, currency: string): Promise<any> {
    const query = `
      query GetUserAccount($userId: uuid!, $currency: currency_enum!) {
        accounts(where: {
          user_id: {_eq: $userId},
          currency: {_eq: $currency},
          is_active: {_eq: true}
        }) {
          id
          available_balance
          withheld_balance
          total_balance
        }
      }
    `;
    const result = await this.executeQuery(query, {
      userId,
      currency,
    });
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
  async getAccountById(accountId: string): Promise<any> {
    const query = `
      query GetAccountById($accountId: uuid!) {
        accounts_by_pk(id: $accountId) {
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

    const result = await this.executeQuery(query, {
      accountId,
    });

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
}
