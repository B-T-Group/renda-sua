import { GraphQLClient } from 'graphql-request';
import {
  CreateOrderMutation,
  CreateOrderMutationVariables,
  GetOrdersQuery,
  GetOrdersQueryVariables,
  GetUsersQuery,
  GetUsersQueryVariables,
} from '../generated/graphql';
import { CREATE_ORDER, GET_ORDERS, GET_USERS } from '../queries/sample-queries';

/**
 * Example service showing how to use GraphQL codegen with Hasura
 */
export class GraphQLExampleService {
  private client: GraphQLClient;

  constructor(endpoint: string, adminSecret: string) {
    this.client = new GraphQLClient(endpoint, {
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
    });
  }

  /**
   * Example: Fetch users with type safety
   */
  async getUsers(): Promise<GetUsersQuery> {
    try {
      const variables: GetUsersQueryVariables = {};
      const data = await this.client.request<GetUsersQuery>(
        GET_USERS,
        variables
      );
      return data;
    } catch (error: any) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Example: Fetch orders with pagination and type safety
   */
  async getOrders(
    limit: number = 10,
    offset: number = 0
  ): Promise<GetOrdersQuery> {
    try {
      const variables: GetOrdersQueryVariables = { limit, offset };
      const data = await this.client.request<GetOrdersQuery>(
        GET_ORDERS,
        variables
      );
      return data;
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  /**
   * Example: Create order with type safety
   */
  async createOrder(
    orderData: CreateOrderMutationVariables['input']
  ): Promise<CreateOrderMutation> {
    try {
      const variables: CreateOrderMutationVariables = { input: orderData };
      const data = await this.client.request<CreateOrderMutation>(
        CREATE_ORDER,
        variables
      );
      return data;
    } catch (error: any) {
      console.error('Error creating order:', error);
      throw error;
    }
  }
}

// Usage example
export const exampleUsage = async () => {
  const service = new GraphQLExampleService(
    'http://localhost:8080/v1/graphql',
    'myadminsecretkey'
  );

  try {
    // Fetch users - fully typed
    const usersResult = await service.getUsers();
    console.log('Users:', usersResult.users);

    // Fetch orders with pagination - fully typed
    const ordersResult = await service.getOrders(5, 0);
    console.log('Orders:', ordersResult.orders);

    // Create order - fully typed
    const newOrder = await service.createOrder({
      order_number: 'TEST-001',
      total_amount: 100.5,
      client_id: 'some-client-id',
    });
    console.log('Created order:', newOrder.insert_orders_one);
  } catch (error) {
    console.error('Example usage failed:', error);
  }
};
