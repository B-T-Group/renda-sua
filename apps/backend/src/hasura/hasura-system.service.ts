import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';

@Injectable()
export class HasuraSystemService {
  private readonly hasuraUrl: string;
  private readonly adminSecret: string;
  private readonly client: GraphQLClient;

  constructor(private readonly configService: ConfigService) {
    console.log('configService', this.configService.get('hasura'));

    this.hasuraUrl =
      this.configService.get<string>('hasura.endpoint') ||
      'http://localhost:8080/v1/graphql';
    this.adminSecret =
      this.configService.get<string>('hasura.adminSecret') ||
      'myadminsecretkey';

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
        }
      }
    `;
    const result = await this.executeQuery(query, { id });
    return result.agents[0] || null;
  }
}
