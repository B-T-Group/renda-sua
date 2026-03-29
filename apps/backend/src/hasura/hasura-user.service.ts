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
  Users,
} from '../generated/graphql';
import { resolveActivePersonaWithDefault } from '../users/persona.util';
import { HasuraSystemService } from './hasura-system.service';

const HASURA_JWT_CLAIMS_NAMESPACE = 'https://hasura.io/jwt/claims';

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
  /** DB `users.id` from JWT `https://hasura.io/jwt/claims` → `x-hasura-user-id`. */
  public user_id!: string;
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
    this.user_id = this._authToken
      ? this.extractHasuraUserIdFromToken(this._authToken)
      : 'anonymous';

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
      this.user_id = this._authToken
        ? this.extractHasuraUserIdFromToken(this._authToken)
        : 'anonymous';
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
      mutation CreateUser($email: String!, $first_name: String!, $last_name: String!, $phone_number: String, $user_type_id: user_types_enum!) {
        insert_users_one(object: {
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id
        }) {
          id
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
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!
      ) {
        insert_users_one(object: {
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
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
    });

    const user = result.insert_users_one;
    
    // Query the client separately using system service (admin privileges)
    // since we can't select it in the mutation return due to permission restrictions
    const clientQuery = `
      query GetClientByUserId($userId: uuid!) {
        clients(where: { user_id: { _eq: $userId } }, limit: 1) {
          id
          user_id
          created_at
          updated_at
        }
      }
    `;
    
    const clientResult = await this.hasuraSystemService.executeQuery(clientQuery, {
      userId: user.id,
    });
    
    const client = clientResult.clients?.[0];
    
    if (!client) {
      throw new Error('Client was not created successfully');
    }

    return {
      user: {
        id: user.id,
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
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!,
        $vehicle_type_id: vehicle_types_enum!
      ) {
        insert_users_one(object: {
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
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
      vehicle_type_id: agentData.vehicle_type_id,
    });

    const user = result.insert_users_one;
    
    // Query the agent separately using system service (admin privileges)
    // since we can't select it in the mutation return due to permission restrictions
    const agentQuery = `
      query GetAgentByUserId($userId: uuid!) {
        agents(where: { user_id: { _eq: $userId } }, limit: 1) {
          id
          user_id
          vehicle_type_id
          is_verified
          is_internal
          created_at
          updated_at
        }
      }
    `;
    
    const agentResult = await this.hasuraSystemService.executeQuery(agentQuery, {
      userId: user.id,
    });
    
    const agent = agentResult.agents?.[0];
    
    if (!agent) {
      throw new Error('Agent was not created successfully');
    }

    return {
      user: {
        id: user.id,
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
        is_internal: agent.is_internal,
        onboarding_complete: agent.onboarding_complete,
        status: agent.status ?? 'active',
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      } as unknown as Agents,
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
    businessData: { name: string; main_interest?: 'sell_items' | 'rent_items' }
  ): Promise<{ user: Users; business: Businesses }> {
    const mutation = `
      mutation CreateUserWithBusiness(
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!,
        $business_name: String!,
        $main_interest: business_main_interest_enum!
      ) {
        insert_users_one(object: {
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id,
          business: {
            data: {
              name: $business_name
              main_interest: $main_interest
            }
          }
        }) {
          id
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
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
      business_name: businessData.name,
      main_interest: businessData.main_interest ?? 'sell_items',
    });

    const user = result.insert_users_one;
    
    // Query the business separately using system service (admin privileges)
    // since we can't select it in the mutation return due to permission restrictions
    const businessQuery = `
      query GetBusinessByUserId($userId: uuid!) {
        businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
          id
          user_id
          name
          main_interest
          is_admin
          is_verified
          image_cleanup_enabled
          created_at
          updated_at
        }
      }
    `;
    
    const businessResult = await this.hasuraSystemService.executeQuery(businessQuery, {
      userId: user.id,
    });
    
    const business = businessResult.businesses?.[0];
    
    if (!business) {
      throw new Error('Business was not created successfully');
    }

    return {
      user: {
        id: user.id,
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
        main_interest: business.main_interest,
        is_admin: business.is_admin,
        is_verified: business.is_verified,
        image_cleanup_enabled: business.image_cleanup_enabled,
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

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length < 2) {
      throw new Error('Invalid JWT format');
    }
    const json = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  }

  /**
   * DB user id from Auth0 Action: `x-hasura-user-id` inside `https://hasura.io/jwt/claims`.
   */
  private extractHasuraUserIdFromToken(token: string): string {
    try {
      const payload = this.decodeJwtPayload(token);
      const claims = payload[HASURA_JWT_CLAIMS_NAMESPACE] as
        | Record<string, unknown>
        | undefined;
      const id =
        claims?.['x-hasura-user-id'] ?? claims?.['X-Hasura-User-Id'];
      if (id === undefined || id === null || String(id).trim() === '') {
        throw new Error('Missing x-hasura-user-id in Hasura JWT claims');
      }
      return String(id);
    } catch (error: any) {
      throw new Error(
        error?.message ||
          'Invalid JWT token or missing Hasura user id in claims'
      );
    }
  }

  /**
   * Auth0 access token `sub` (for logging / correlation; not stored on `users`).
   */
  getAuthSubject(): string {
    if (!this._authToken) {
      return 'anonymous';
    }
    try {
      const payload = this.decodeJwtPayload(this._authToken);
      const sub = payload.sub;
      if (!sub || typeof sub !== 'string') {
        throw new Error('Invalid JWT: missing sub claim');
      }
      return sub;
    } catch (error: any) {
      throw new Error(
        error?.message || 'Invalid JWT token or missing sub claim'
      );
    }
  }

  /**
   * Same as `user_id` (from Hasura JWT claims); use for permission-aligned lookups.
   */
  getUserId(): string {
    return this.user_id;
  }

  /** Raw `X-Active-Persona` header for multi-persona REST flows. */
  getActivePersonaHeader(): string | undefined {
    const h = this.request?.headers;
    if (!h) return undefined;
    const raw = h['x-active-persona'] ?? h['X-Active-Persona'];
    return typeof raw === 'string' ? raw : undefined;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.hasuraUrl &&
      this._authToken &&
      this.user_id &&
      this.user_id !== 'anonymous'
    );
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

    const addressResult = await this.hasuraSystemService.executeQuery(query, {
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
   * Get the current user by JWT Hasura user id (`x-hasura-user-id`).
   */
  async getUser(): Promise<
    Users & {
      client?: Clients;
      agent?: Agents;
      business?: Businesses;
      addresses?: Addresses[];
    }
  > {
    if (!this.user_id || this.user_id === 'anonymous') {
      throw new Error(
        'No authenticated user. Please provide a valid authentication token.'
      );
    }

    try {
      const userData = await this.hasuraSystemService.getUserByIdWithRelations(
        this.user_id
      );
      if (!userData) {
        throw new Error(`User not found for id: ${this.user_id}`);
      }

      // Build the user object with client/agent/business data
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
      };

      // Addresses for the active persona only (client → client_addresses, etc.).
      const activePersona = resolveActivePersonaWithDefault(
        {
          client: user.client,
          agent: user.agent,
          business: user.business,
        },
        this.getActivePersonaHeader()
      );
      const addresses = await this.hasuraSystemService.getAllUserAddresses(
        user.id,
        activePersona
      );
      user.addresses = addresses as Addresses[];

      return user;
    } catch (error: any) {
      this.logger.error('Error in getUser()', {
        userId: this.user_id,
        error: error.message,
        stack: error.stack,
      });

      if (error.message?.includes('User not found')) {
        throw error;
      }
      throw new Error(
        `Failed to get user by id: ${error.message || 'Unknown error'}`
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
