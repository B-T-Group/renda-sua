import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';
import { HasuraSystemService } from './hasura-system.service';
import { GraphQLClient } from 'graphql-request';

export interface UserRecord {
  id: string;
  identifier: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type_id: string;
  client?: ClientRecord;
  agent?: AgentRecord;
  business?: BusinessRecord;
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
  created_at: string;
  updated_at: string;
}

export interface BusinessRecord {
  id: string;
  user_id: string;
  name: string;
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
}

export interface Item {
  id: string;
  name: string;
  price: number;
  currency: string;
  available_quantity: number;
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
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly configService: ConfigService<Configuration>
  ) {
    const hasuraConfig = this.configService.get('hasura');
    this.hasuraUrl =
      hasuraConfig?.endpoint || 'http://localhost:8080/v1/graphql';
    this._authToken = this.extractAuthToken();
    this.identifier = this.extractSubClaim();

    console.log('configService:headers', {
      Authorization: `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
    });

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
          user_type_id
          created_at
          updated_at
          agent {
            id
            user_id
            vehicle_type_id
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
        user_type_id: user.user_type_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      agent: {
        id: agent.id,
        user_id: agent.user_id,
        vehicle_type_id: agent.vehicle_type_id,
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
          user_type_id
          created_at
          updated_at
          business {
            id
            user_id
            name
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
        user_type_id: user.user_type_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      business: {
        id: business.id,
        user_id: business.user_id,
        name: business.name,
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
   * Get user address by user ID
   */
  async getUserAddress(userId: string, entityType: string): Promise<any> {
    const getUserAddressQuery = `
      query GetUserAddress($userId: uuid!, $entityType: entity_type_enum!) {
        addresses(where: {entity_id: {_eq: $userId}, entity_type: {_eq: $entityType}}) {
          id
          entity_id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
          is_primary
          created_at
          updated_at
        }
      }
    `;

    const addressResult = await this.executeQuery(getUserAddressQuery, {
      userId,
      entityType,
    });

    return addressResult.addresses[0];
  }

  /**
   * Get all user addresses by user ID
   */
  async getAllUserAddresses(userId: string): Promise<any[]> {
    const getAllUserAddressesQuery = `
      query GetAllUserAddresses($userId: uuid!) {
        addresses(where: {entity_id: {_eq: $userId}}) {
          id
          user_id
          address_line_1
          address_line_2
          city
          state
          postal_code
          country
          is_primary
          created_at
          updated_at
        }
      }
    `;

    const addressResult = await this.executeQuery(getAllUserAddressesQuery, {
      userId,
    });

    return addressResult.addresses || [];
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

    switch (userResult.users[0].user_type_id) {
      case 'client':
        const client = await this.getUserClient(userResult.users[0].id);
        userResult.users[0].client = client;
        break;
      case 'agent':
        const agent = await this.getUserAgent(userResult.users[0].id);
        userResult.users[0].agent = agent;
        break;
      case 'business':
        const business = await this.getUserBusiness(userResult.users[0].id);
        userResult.users[0].business = business;
        break;
      default:
        throw new Error('Invalid user type');
    }

    return userResult.users[0];
  }

  private async getUserClient(userId: string): Promise<ClientRecord> {
    const getUserClientQuery = `
      query GetUserClient($userId: uuid!) {
        clients(where: {user_id: {_eq: $userId}}) {
          id
          user_id
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
          name
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

  /**
   * Creates a random 8-digit order number
   */
  private createOrderNumber(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  /**
   * Create a new order with validation and fund withholding
   */
  async createOrder(orderData: CreateOrderRequest): Promise<OrderResult> {
    // Get the current user
    const user = await this.getUser();

    if (!user.client) {
      throw new Error('Client not found');
    }

    const address = await this.getUserAddress(user.id, 'user');

    if (!address) {
      throw new Error('Address not found');
    }

    // Get the business inventory item
    const getBusinessInventoryQuery = `
      query GetBusinessInventory($businessInventoryId: uuid!) {
        business_inventory_by_pk(id: $businessInventoryId) {
          id
          available_quantity
          selling_price
          is_active
          business_location_id
          business_location {
            business_id
          }
          item {
            id
            name
            description
            currency
          }
        }
      }
    `;

    const businessInventoryResult = await this.executeQuery(
      getBusinessInventoryQuery,
      {
        businessInventoryId: orderData.item.business_inventory_id,
      }
    );

    if (!businessInventoryResult.business_inventory_by_pk) {
      throw new Error('No valid business inventory found');
    }

    const businessInventory =
      businessInventoryResult.business_inventory_by_pk as any;

    if (!businessInventory.is_active) {
      throw new Error(
        `Item ${businessInventory.item.name} is not currently available`
      );
    }

    if (orderData.item.quantity > businessInventory.available_quantity) {
      throw new Error(
        `Insufficient quantity for item ${businessInventory.item.name}. Available: ${businessInventory.available_quantity}, Requested: ${orderData.item.quantity}`
      );
    }

    const totalAmount =
      businessInventory.selling_price * orderData.item.quantity;
    const currency = businessInventory.item.currency;

    // Check user account for the currency
    const getAccountsQuery = `
      query GetUserAccounts($userId: uuid!, $currency: currency_enum!) {
        accounts(where: {user_id: {_eq: $userId}, currency: {_eq: $currency}}) {
          id
          currency
          available_balance
          withheld_balance
          total_balance
        }
      }
    `;

    const accountsResult = await this.executeQuery(getAccountsQuery, {
      userId: user.id,
      currency,
    });

    const userAccounts = (accountsResult.accounts || []) as Account[];
    const account = userAccounts[0];

    if (!account) {
      throw new Error(`No account found for currency ${currency}`);
    }

    if (account.available_balance < totalAmount) {
      throw new Error(
        `Insufficient funds for currency ${currency}. Required: ${totalAmount}, Available: ${account.available_balance}`
      );
    }

    const orderNumber = this.createOrderNumber();
    const business_location_id = businessInventory.business_location_id;
    const delivery_address_id = address.id;
    const subtotal = totalAmount;
    const tax_amount = 0;
    const delivery_fee = 0;
    const total_amount = subtotal + tax_amount + delivery_fee;
    const current_status = 'pending';
    const business_id = businessInventory.business_location.business_id;
    const payment_method = 'online';
    const payment_status = 'pending';
    const special_instructions = '';
    const estimated_delivery_time = null;
    const preferred_delivery_time = null;
    const actual_delivery_time = null;
    const assigned_agent_id = null;

    // Create order with all related data in a transaction
    const createOrderMutation = `
      mutation CreateOrderWithItems(
        $clientId: uuid!,
        $businessId: uuid!,
        $businessLocationId: uuid!,
        $deliveryAddressId: uuid!,
        $orderNumber: String!,
        $orderItems: [order_items_insert_input!]!,
        $currency: String!,
        $subTotal: numeric!,
        $taxAmount: numeric!,
        $deliveryFee: numeric!,
        $totalAmount: numeric!,
        $currentStatus: order_status!,
        $paymentMethod: String!,
        $paymentStatus: String!,
        $specialInstructions: String!,
        $estimatedDeliveryTime: timestamptz,
        $preferredDeliveryTime: timestamptz,
        $actualDeliveryTime: timestamptz,
        $assignedAgentId: uuid
      ) {
        insert_orders_one(object: {
          client_id: $clientId,
          business_id: $businessId,
          business_location_id: $businessLocationId,
          delivery_address_id: $deliveryAddressId,
          currency: $currency,
          order_number: $orderNumber,
          payment_method: $paymentMethod,
          payment_status: $paymentStatus,
          delivery_fee: $deliveryFee,
          subtotal: $subTotal,
          tax_amount: $taxAmount,
          total_amount: $totalAmount,
          special_instructions: $specialInstructions,
          actual_delivery_time: $actualDeliveryTime,
          estimated_delivery_time: $estimatedDeliveryTime,
          preferred_delivery_time: $preferredDeliveryTime,
          current_status: $currentStatus,
          assigned_agent_id: $assignedAgentId,
          order_items: {
            data: $orderItems
          }
        }) {
          id
          currency
          order_number
          payment_method
          payment_status
          delivery_fee
          subtotal
          tax_amount
          total_amount
          special_instructions
          actual_delivery_time
          created_at
          estimated_delivery_time
          preferred_delivery_time
          updated_at
          current_status
          assigned_agent_id
          business_id
          business_location_id
          client_id
          delivery_address_id
          order_items {
            id
            business_inventory_id
            item_id
            item_name
            quantity
            unit_price
            total_price
          }
        }
      }
    `;

    // Prepare order items data
    const orderItemsData = [
      {
        business_inventory_id: orderData.item.business_inventory_id,
        item_id: businessInventory.item.id,
        item_name: businessInventory.item.name,
        item_description: businessInventory.item.description,
        quantity: orderData.item.quantity,
        unit_price: businessInventory.selling_price,
        total_price: totalAmount,
      },
    ];

    // Create the order
    const orderResult = await this.executeMutation(createOrderMutation, {
      clientId: user.client.id,
      businessId: business_id,
      businessLocationId: business_location_id,
      deliveryAddressId: delivery_address_id,
      orderNumber: orderNumber,
      orderItems: orderItemsData,
      currency: currency,
      subTotal: subtotal,
      taxAmount: tax_amount,
      deliveryFee: delivery_fee,
      totalAmount: total_amount,
      currentStatus: current_status,
      paymentMethod: payment_method,
      paymentStatus: payment_status,
      specialInstructions: special_instructions,
      estimatedDeliveryTime: estimated_delivery_time,
      preferredDeliveryTime: preferred_delivery_time,
      actualDeliveryTime: actual_delivery_time,
      assignedAgentId: assigned_agent_id,
    });

    const order = orderResult.insert_orders_one;

    // Create order status history after order is created
    const createStatusHistoryMutation = `
      mutation CreateStatusHistory($orderId: uuid!, $status: order_status!, $notes: String!, $changedByType: String!, $changedByUserId: uuid!) {
        insert_order_status_history(objects: [{
          order_id: $orderId,
          status: $status,
          notes: $notes,
          changed_by_type: $changedByType,
          changed_by_user_id: $changedByUserId
        }]) {
          affected_rows
          returning {
            id
            order_id
            status
            created_at
          }
        }
      }
    `;

    await this.executeMutation(createStatusHistoryMutation, {
      orderId: order.id,
      status: 'pending',
      notes: 'Order created',
      changedByType: 'client',
      changedByUserId: user.id,
    });

    // Withhold funds from user accounts
    const withholdFundsMutation = `
      mutation WithholdFunds($accountId: uuid!, $amount: numeric!) {
        update_accounts_by_pk(
          pk_columns: {id: $accountId},
          _inc: {
            available_balance: $amount,
            withheld_balance: $amount
          }
        ) {
          id
          available_balance
          withheld_balance
          total_balance
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(withholdFundsMutation, {
      accountId: account!.id,
      amount: -totalAmount, // Negative to decrease available_balance
    });

    return {
      ...order,
      total_amount: totalAmount,
    };
  }
}
