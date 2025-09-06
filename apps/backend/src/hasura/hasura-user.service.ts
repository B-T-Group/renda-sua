import { Inject, Injectable, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { GraphQLClient } from 'graphql-request';
import { Configuration } from '../config/configuration';

export interface AddressRecord {
  id: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
  address_type: string;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  identifier: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  email_verified?: boolean;
  user_type_id: string;
  client?: ClientRecord;
  agent?: AgentRecord;
  business?: BusinessRecord;
  addresses?: AddressRecord[];
  created_at: string;
  updated_at: string;
}

export interface ClientRecord {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRecord {
  id: string;
  user_id: string;
  vehicle_type_id: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessRecord {
  id: string;
  user_id: string;
  name: string;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithClientRecord {
  user: UserRecord;
  client: ClientRecord;
}

export interface UserWithAgentRecord {
  user: UserRecord;
  agent: AgentRecord;
}

export interface UserWithBusinessRecord {
  user: UserRecord;
  business: BusinessRecord;
}

export interface OrderItem {
  business_inventory_id: string;
  quantity: number;
}

export interface CreateOrderRequest {
  item: OrderItem;
  special_instructions?: string;
  verified_agent_delivery?: boolean;
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
  public identifier!: string;
  private readonly hasuraUrl: string;
  private _authToken: string | null = null;
  private readonly client: GraphQLClient;
  constructor(
    @Inject(REQUEST) private readonly request: any,
    private readonly configService: ConfigService<Configuration>
  ) {
    const hasuraConfig = this.configService.get('hasura');
    this.hasuraUrl =
      hasuraConfig?.endpoint || 'http://localhost:8080/v1/graphql';
    this._authToken = this.extractAuthToken();
    this.identifier = this.extractSubClaim();

    this.client = new GraphQLClient(this.hasuraUrl, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get auth token lazily (only when needed)
   */
  private get authToken(): string {
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
    return new GraphQLClient(this.hasuraUrl, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute a GraphQL query with user privileges
   */
  async executeQuery(query: string, variables?: any): Promise<any> {
    return this.client.request(query, variables);
  }

  /**
   * Execute a GraphQL mutation with user privileges
   */
  async executeMutation(mutation: string, variables?: any): Promise<any> {
    return this.client.request(mutation, variables);
  }

  /**
   * Create a new user record
   */
  async createUser(userData: {
    email: string;
    first_name: string;
    last_name: string;
    user_type_id: string;
  }): Promise<UserRecord> {
    const mutation = `
      mutation CreateUser($identifier: String!, $email: String!, $first_name: String!, $last_name: String!, $user_type_id: user_types_enum!) {
        insert_users_one(object: {
          identifier: $identifier,
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
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
    user_type_id: string;
  }): Promise<UserWithClientRecord> {
    const mutation = `
      mutation CreateUserWithClient(
        $identifier: String!, 
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $user_type_id: user_types_enum!
      ) {
        insert_users_one(object: {
          identifier: $identifier,
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
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
      },
      client: {
        id: client.id,
        user_id: client.user_id,
        created_at: client.created_at,
        updated_at: client.updated_at,
      },
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
      user_type_id: string;
    },
    agentData: { vehicle_type_id: string }
  ): Promise<UserWithAgentRecord> {
    const mutation = `
      mutation CreateUserWithAgent(
        $identifier: String!, 
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $user_type_id: user_types_enum!,
        $vehicle_type_id: vehicle_types_enum!
      ) {
        insert_users_one(object: {
          identifier: $identifier,
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
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
      },
      agent: {
        id: agent.id,
        user_id: agent.user_id,
        vehicle_type_id: agent.vehicle_type_id,
        is_verified: agent.is_verified,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      },
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
      user_type_id: string;
    },
    businessData: { name: string }
  ): Promise<UserWithBusinessRecord> {
    const mutation = `
      mutation CreateUserWithBusiness(
        $identifier: String!, 
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $user_type_id: user_types_enum!,
        $business_name: String!
      ) {
        insert_users_one(object: {
          identifier: $identifier,
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
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
      },
      business: {
        id: business.id,
        user_id: business.user_id,
        name: business.name,
        is_admin: business.is_admin,
        is_verified: business.is_verified,
        created_at: business.created_at,
        updated_at: business.updated_at,
      },
    };
  }

  /**
   * Extract auth token from request headers
   */
  private extractAuthToken(): string {
    const authHeader = this.request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid or missing authorization header');
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Extract sub claim from JWT token
   */
  private extractSubClaim(): string {
    try {
      // This is a simplified JWT decode - in production, you should use a proper JWT library
      const token = this.authToken;
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      return payload.sub || payload.user_id || payload.id;
    } catch (error) {
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
   * Get all user addresses by user ID and user type
   */
  async getAllUserAddresses(userId: string, userType: string): Promise<any[]> {
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

  /**
   * Get the current user by identifier
   */
  async getUser(): Promise<UserRecord> {
    const getUserQuery = `
      query GetUserByIdentifier($identifier: String!) {
        users(where: {identifier: {_eq: $identifier}}) {
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

    const userResult = await this.executeQuery(getUserQuery, {
      identifier: this.identifier,
    });

    if (!userResult.users || userResult.users.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.users[0];

    // Get user type-specific data
    switch (user.user_type_id) {
      case 'client': {
        const client = await this.getUserClient(user.id);
        user.client = client;
        break;
      }
      case 'agent': {
        const agent = await this.getUserAgent(user.id);
        user.agent = agent;
        break;
      }
      case 'business': {
        const business = await this.getUserBusiness(user.id);
        user.business = business;
        break;
      }
      default:
        throw new Error('Invalid user type');
    }

    // Get user addresses
    const addresses = await this.getAllUserAddresses(
      user.id,
      user.user_type_id
    );
    user.addresses = addresses;

    return user;
  }

  private async getUserClient(userId: string): Promise<ClientRecord> {
    const getUserClientQuery = `
      query GetUserClient($userId: uuid!) {
        clients(where: {user_id: {_eq: $userId}}) {
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

    const clientResult = await this.executeQuery(getUserClientQuery, {
      userId,
    });

    return clientResult.clients[0];
  }

  private async getUserBusiness(userId: string): Promise<BusinessRecord> {
    const getUserBusinessQuery = `
      query GetUserBusiness($userId: uuid!) {
        businesses(where: {user_id: {_eq: $userId}}) {
          id
          user_id
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
          name
          is_admin
          is_verified
          created_at
          updated_at
        }
      }
    `;

    const businessResult = await this.executeQuery(getUserBusinessQuery, {
      userId,
    });
    return businessResult.businesses[0];
  }

  private async getUserAgent(userId: string): Promise<AgentRecord> {
    const getUserAgentQuery = `
      query GetUserAgent($userId: uuid!) {
        agents(where: {user_id: {_eq: $userId}}) {
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

    const agentResult = await this.executeQuery(getUserAgentQuery, {
      userId,
    });
    return agentResult.agents[0];
  }
}
