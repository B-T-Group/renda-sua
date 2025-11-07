import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { GraphQLClient } from 'graphql-request';
import { Configuration } from '../config/configuration';
import {
  Addresses,
  Agents,
  Businesses,
  Clients,
  GetUserByIdentifierQuery,
  Users,
} from '../generated/graphql';
import { HasuraSystemService } from './hasura-system.service';
import {
  GET_USER_BY_IDENTIFIER,
  GET_USER_BY_IDENTIFIER_WITH_RELATIONS,
} from './hasura.queries';

export interface OrderItem {
  business_inventory_id: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: OrderItem[];
  special_instructions?: string;
  verified_agent_delivery?: boolean;
  delivery_address_id: string;
  phone_number?: string;
  requires_fast_delivery?: boolean;
  delivery_window?: {
    slot_id: string;
    preferred_date: string;
    special_instructions?: string;
  };
}

export interface Item {
  id: string;
  name: string;
  price: number;
  currency: string;
  computed_available_quantity: number;
}

export interface Account {
  id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  total_balance: number;
}

export interface OrderResult {
  id: string;
  user_id: string;
  status: string;
  total_price: number;
  created_at: string;
  order_items: any[];
}

@Injectable({ scope: Scope.REQUEST })
export class HasuraUserService {
  private readonly logger = new Logger(HasuraUserService.name);
  public identifier!: string;
  private readonly hasuraUrl: string;
  private _authToken: string | null = null;
  private readonly client: GraphQLClient;
  constructor(
    @Inject(REQUEST) private readonly request: any,
    private readonly configService: ConfigService<Configuration>,
    private readonly hasuraSystemService: HasuraSystemService
  ) {
    const hasuraConfig = this.configService.get('hasura');
    this.hasuraUrl =
      hasuraConfig?.endpoint || 'http://localhost:8080/v1/graphql';
    this._authToken = this.extractAuthToken();
    this.identifier = this.extractSubClaim();

    // Build headers based on whether we have a token or not
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this._authToken) {
      headers.Authorization = `Bearer ${this._authToken}`;
    } else {
      // Default to anonymous role when no token is present
      headers['X-Hasura-Role'] = 'anonymous';
    }

    this.client = new GraphQLClient(this.hasuraUrl, {
      headers,
    });
  }

  /**
   * Get auth token lazily (only when needed)
   */
  private get authToken(): string | null {
    if (!this._authToken) {
      this._authToken = this.extractAuthToken();
      this.identifier = this.extractSubClaim();
    }
    return this._authToken;
  }

  /**
   * Creates a GraphQL client with user's auth token
   */
  createGraphQLClient(): any {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    } else {
      // Default to anonymous role when no token is present
      headers['X-Hasura-Role'] = 'anonymous';
    }

    return new GraphQLClient(this.hasuraUrl, {
      headers,
    });
  }

  /**
   * Execute a GraphQL query with user privileges
   */
  async executeQuery<T = any>(query: string, variables?: any): Promise<T> {
    return this.client.request<T>(query, variables);
  }

  /**
   * Execute a GraphQL mutation with user privileges
   */
  async executeMutation<T = any>(
    mutation: string,
    variables?: any
  ): Promise<T> {
    return this.client.request<T>(mutation, variables);
  }

  /**
   * Create a new user record
   */
  async createUser(userData: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    user_type_id: string;
  }): Promise<Users> {
    const mutation = `
      mutation CreateUser($identifier: String!, $email: String!, $first_name: String!, $last_name: String!, $phone_number: String, $user_type_id: user_types_enum!) {
        insert_users_one(object: {
          identifier: $identifier,
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id
        }) {
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

    const result = await this.executeMutation(mutation, {
      identifier: this.identifier, // Use identifier from token
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
    });

    return result.insert_users_one;
  }

  /**
   * Create a new user with client record using nested query
   */
  async createUserWithClient(userData: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    user_type_id: string;
  }): Promise<{ user: Users; client: Clients }> {
    const mutation = `
      mutation CreateUserWithClient(
        $identifier: String!, 
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!
      ) {
        insert_users_one(object: {
          identifier: $identifier,
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id,
          client: {
            data: {}
          }
        }) {
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
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      identifier: this.identifier, // Use identifier from token
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
    });

    const user = result.insert_users_one;
    const client = user.client; // Get the first (and only) client

    return {
      user: {
        id: user.id,
        identifier: user.identifier,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        phone_number_verified: user.phone_number_verified,
        email_verified: user.email_verified,
        user_type_id: user.user_type_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      } as Users,
      client: {
        id: client.id,
        user_id: client.user_id,
        created_at: client.created_at,
        updated_at: client.updated_at,
      } as Clients,
    };
  }

  /**
   * Create a new user with agent record using nested query
   */
  async createUserWithAgent(
    userData: {
      email: string;
      first_name: string;
      last_name: string;
      phone_number?: string;
      user_type_id: string;
    },
    agentData: { vehicle_type_id: string }
  ): Promise<{ user: Users; agent: Agents }> {
    const mutation = `
      mutation CreateUserWithAgent(
        $identifier: String!, 
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!,
        $vehicle_type_id: vehicle_types_enum!
      ) {
        insert_users_one(object: {
          identifier: $identifier,
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id,
          agent: {
            data: {
              vehicle_type_id: $vehicle_type_id
            }
          }
        }) {
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
          agent {
            id
            user_id
            vehicle_type_id
            is_verified
            created_at
            updated_at
          }
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      identifier: this.identifier, // Use identifier from token
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
      vehicle_type_id: agentData.vehicle_type_id,
    });

    const user = result.insert_users_one;
    const agent = user.agent; // Get the first (and only) agent

    return {
      user: {
        id: user.id,
        identifier: user.identifier,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        phone_number_verified: user.phone_number_verified,
        email_verified: user.email_verified,
        user_type_id: user.user_type_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      } as Users,
      agent: {
        id: agent.id,
        user_id: agent.user_id,
        vehicle_type_id: agent.vehicle_type_id,
        is_verified: agent.is_verified,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      } as Agents,
    };
  }

  /**
   * Create a new user with business record using nested query
   */
  async createUserWithBusiness(
    userData: {
      email: string;
      first_name: string;
      last_name: string;
      phone_number?: string;
      user_type_id: string;
    },
    businessData: { name: string }
  ): Promise<{ user: Users; business: Businesses }> {
    const mutation = `
      mutation CreateUserWithBusiness(
        $identifier: String!, 
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!,
        $business_name: String!
      ) {
        insert_users_one(object: {
          identifier: $identifier,
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id,
          business: {
            data: {
              name: $business_name
            }
          }
        }) {
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

    const result = await this.executeMutation(mutation, {
      identifier: this.identifier, // Use identifier from token
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
      business_name: businessData.name,
    });

    const user = result.insert_users_one;
    const business = user.business; // Get the first (and only) business

    return {
      user: {
        id: user.id,
        identifier: user.identifier,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        phone_number_verified: user.phone_number_verified,
        email_verified: user.email_verified,
        user_type_id: user.user_type_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      } as Users,
      business: {
        id: business.id,
        user_id: business.user_id,
        name: business.name,
        is_admin: business.is_admin,
        is_verified: business.is_verified,
        created_at: business.created_at,
        updated_at: business.updated_at,
      } as Businesses,
    };
  }

  /**
   * Extract auth token from request headers
   */
  private extractAuthToken(): string | null {
    const authHeader = this.request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null; // Return null instead of throwing error
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Extract sub claim from JWT token
   */
  private extractSubClaim(): string {
    if (!this._authToken) {
      return 'anonymous'; // Return anonymous identifier when no token
    }

    try {
      // This is a simplified JWT decode - in production, you should use a proper JWT library
      const token = this._authToken;
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      return payload.sub || payload.user_id || payload.id;
    } catch {
      throw new Error('Invalid JWT token or missing sub claim');
    }
  }

  /**
   * Get the user identifier (sub claim)
   */
  getIdentifier(): string {
    return this.identifier;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.hasuraUrl && this._authToken && this.identifier);
  }

  /**
   * Get user address by user ID and user type
   */
  async getUserAddress(userId: string, userType: string): Promise<any> {
    let query: string;

    switch (userType) {
      case 'client':
        query = `
          query GetClientAddress($userId: uuid!) {
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
          query GetAgentAddress($userId: uuid!) {
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
          query GetBusinessAddress($userId: uuid!) {
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

    const address = addresses?.[0]?.address;
    if (!address) {
      return null;
    }

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
  }

  /**
   * Get the current user by identifier
   */
  async getUser(): Promise<
    Users & {
      client?: Clients;
      agent?: Agents;
      business?: Businesses;
      addresses?: Addresses[];
    }
  > {
    // Validate identifier exists
    if (!this.identifier) {
      throw new Error('User identifier is missing from authentication token');
    }

    try {
      // Use consolidated query to fetch user with all related data in one request
      const userResult = await this.executeQuery<any>(
        GET_USER_BY_IDENTIFIER_WITH_RELATIONS,
        {
          identifier: this.identifier,
        }
      );

      if (!userResult.users || userResult.users.length === 0) {
        throw new Error(`User not found with identifier: ${this.identifier}`);
      }

      const userData = userResult.users[0];

      // Extract addresses from the appropriate junction table based on user type
      let addresses: Addresses[] = [];
      if (userData.client?.client_addresses) {
        addresses = userData.client.client_addresses
          .map((ca: any) => {
            const address = ca.address;
            if (!address) return null;

            // Create formatted address
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
          .filter(Boolean);
      } else if (userData.agent?.agent_addresses) {
        addresses = userData.agent.agent_addresses
          .map((aa: any) => {
            const address = aa.address;
            if (!address) return null;

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
          .filter(Boolean);
      } else if (userData.business?.business_addresses) {
        addresses = userData.business.business_addresses
          .map((ba: any) => {
            const address = ba.address;
            if (!address) return null;

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
          .filter(Boolean);
      }

      // Build the user object with all data
      const user: Users & {
        client?: Clients;
        agent?: Agents;
        business?: Businesses;
        addresses?: Addresses[];
      } = {
        ...userData,
        client: userData.client || undefined,
        agent: userData.agent || undefined,
        business: userData.business || undefined,
        addresses: addresses as Addresses[],
      };

      return user;
    } catch (error: any) {
      // Log the error for debugging
      this.logger.error('Error in getUser()', {
        identifier: this.identifier,
        error: error.message,
        stack: error.stack,
      });
      
      // Re-throw with more context
      if (error.message.includes('User not found')) {
        throw error;
      }
      throw new Error(
        `Failed to get user by identifier: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Get an address by ID
   */
  async getUserAddressById(addressId: string): Promise<any> {
    if (!addressId) {
      throw new Error('Address ID is required');
    }

    const query = `
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

    const result = await this.executeQuery(query, {
      addressId,
    });

    const address = result.addresses_by_pk;
    if (!address) {
      return null;
    }

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
  }
}
