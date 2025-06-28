import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

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
  total_amount: number;
  created_at: string;
  order_items: any[];
}

@Injectable({ scope: Scope.REQUEST })
export class HasuraUserService {
  public identifier!: string;
  private readonly hasuraUrl: string;
  private _authToken: string | null = null;

  constructor(@Inject(REQUEST) private readonly request: any) {
    this.hasuraUrl =
      process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql';
    this._authToken = this.extractAuthToken();
    this.identifier = this.extractSubClaim();
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
    const { GraphQLClient } = require('graphql-request');
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
    const client = this.createGraphQLClient();
    return client.request(query, variables);
  }

  /**
   * Execute a GraphQL mutation with user privileges
   */
  async executeMutation(mutation: string, variables?: any): Promise<any> {
    const client = this.createGraphQLClient();
    return client.request(mutation, variables);
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
            created_at
            updated_at
          }
          business {
            id
            user_id
            name
            created_at
            updated_at
          }
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

    console.log(userResult.users[0]);

    return userResult.users[0];
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

    // Get items with their prices, currencies, and available quantities from business_inventory
    const businessInventoryIds = [orderData.item.business_inventory_id];
    const getBusinessInventoryQuery = `
      query GetBusinessInventory($businessInventoryIds: [uuid!]!) {
        business_inventory(where: {id: {_in: $businessInventoryIds}}) {
          id
          available_quantity
          selling_price
          is_active
          business_location_id
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
        businessInventoryIds,
      }
    );

    if (
      !businessInventoryResult.business_inventory ||
      businessInventoryResult.business_inventory.length === 0
    ) {
      throw new Error('No valid business inventory found');
    }

    const businessInventoryItems =
      businessInventoryResult.business_inventory as any[];

    // Group items by currency and calculate totals
    const currencyGroups = new Map<string, { items: any[]; total: number }>();

    for (const orderItem of [orderData.item]) {
      const businessInventory = businessInventoryItems.find(
        (bi: any) => bi.id === orderItem.business_inventory_id
      );
      if (!businessInventory) {
        throw new Error(
          `Business inventory ${orderItem.business_inventory_id} not found`
        );
      }

      if (!businessInventory.is_active) {
        throw new Error(
          `Item ${businessInventory.item.name} is not currently available`
        );
      }

      if (orderItem.quantity > businessInventory.available_quantity) {
        throw new Error(
          `Insufficient quantity for item ${businessInventory.item.name}. Available: ${businessInventory.available_quantity}, Requested: ${orderItem.quantity}`
        );
      }

      const total = businessInventory.selling_price * orderItem.quantity;
      const currency = businessInventory.item.currency;

      if (!currencyGroups.has(currency)) {
        currencyGroups.set(currency, { items: [], total: 0 });
      }

      currencyGroups.get(currency)!.items.push({
        ...orderItem,
        businessInventory: {
          ...businessInventory,
          item: businessInventory.item,
        },
      });
      currencyGroups.get(currency)!.total += total;
    }

    // Check user accounts for each currency
    const currencies = Array.from(currencyGroups.keys());
    const getAccountsQuery = `
      query GetUserAccounts($userId: uuid!, $currencies: [currency_enum!]!) {
        accounts(where: {user_id: {_eq: $userId}, currency: {_in: $currencies}}) {
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
      currencies,
    });

    const userAccounts = (accountsResult.accounts || []) as Account[];

    // Validate funds for each currency
    for (const [currency, { total }] of currencyGroups) {
      const account = userAccounts.find(
        (acc: Account) => acc.currency === currency
      );

      if (!account) {
        throw new Error(`No account found for currency ${currency}`);
      }

      if (account.available_balance < total) {
        throw new Error(
          `Insufficient funds for currency ${currency}. Required: ${total}, Available: ${account.available_balance}`
        );
      }
    }

    // Create order with all related data in a transaction
    const createOrderMutation = `
      mutation CreateOrderWithItems(
        $clientId: uuid!,
        $businessId: uuid!,
        $orderItems: [order_items_insert_input!]!,
        $statusHistory: order_status_history_insert_input!
      ) {
        insert_orders_one(object: {
          client_id: $clientId,
          business_id: $businessId,
          status: "pending",
          total_amount: 0,
          order_items: {
            data: $orderItems
          }
        }) {
          id
          user_id
          status
          total_amount
          created_at
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
        
        insert_order_status_history_one(object: $statusHistory) {
          id
          order_id
          status
          created_at
        }
      }
    `;

    // Prepare order items data
    const orderItemsData = [];
    let totalOrderAmount = 0;

    for (const [currency, { items: currencyItems }] of currencyGroups) {
      for (const orderItem of currencyItems) {
        const totalPrice =
          orderItem.businessInventory.selling_price * orderItem.quantity;
        totalOrderAmount += totalPrice;

        orderItemsData.push({
          business_inventory_id: orderItem.businessInventory.id,
          item_id: orderItem.businessInventory.item.id,
          item_name: orderItem.businessInventory.item.name,
          item_description: orderItem.businessInventory.item.description,
          quantity: orderItem.quantity,
          unit_price: orderItem.businessInventory.selling_price,
          total_price: totalPrice,
        });
      }
    }

    // Create the order
    const orderResult = await this.executeMutation(createOrderMutation, {
      clientId: user.client.id,
      orderItems: orderItemsData,
      statusHistory: {
        order_id: null, // Will be set after order creation
        status: 'pending',
        notes: 'Order created',
      },
    });

    const order = orderResult.insert_orders_one;

    // Update the order with total amount
    const updateOrderMutation = `
      mutation UpdateOrderTotal($orderId: uuid!, $totalAmount: numeric!) {
        update_orders_by_pk(
          pk_columns: {id: $orderId},
          _set: {total_amount: $totalAmount}
        ) {
          id
          total_amount
        }
      }
    `;

    await this.executeMutation(updateOrderMutation, {
      orderId: order.id,
      totalAmount: totalOrderAmount,
    });

    // Update order status history with the correct order_id
    const updateStatusHistoryMutation = `
      mutation UpdateStatusHistoryOrderId($orderId: uuid!) {
        update_order_status_history(
          where: {order_id: {_is_null: true}},
          _set: {order_id: $orderId}
        ) {
          affected_rows
        }
      }
    `;

    await this.executeMutation(updateStatusHistoryMutation, {
      orderId: order.id,
    });

    // Withhold funds from user accounts
    for (const [currency, { total }] of currencyGroups) {
      const account = userAccounts.find(
        (acc: Account) => acc.currency === currency
      );

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

      await this.executeMutation(withholdFundsMutation, {
        accountId: account!.id,
        amount: -total, // Negative to decrease available_balance
      });
    }

    return {
      ...order,
      total_amount: totalOrderAmount,
    };
  }
}
