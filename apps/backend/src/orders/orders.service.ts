import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../accounts/accounts.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrderStatusService } from './order-status.service';

export interface OrderStatusChangeRequest {
  orderId: string;
  notes?: string;
}
export interface GetOrderRequest {
  orderId: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly accountsService: AccountsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly orderStatusService: OrderStatusService
  ) {}

  async confirmOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business)
      throw new HttpException(
        'Only business users can confirm orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to confirm this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'pending')
      throw new HttpException(
        `Cannot confirm order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'confirmed'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'confirmed',
      'Order confirmed by business',
      'business',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order confirmed successfully',
    };
  }

  async startPreparing(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business)
      throw new HttpException(
        'Only business users can start preparing orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to start preparing this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'confirmed')
      throw new HttpException(
        `Cannot start preparing order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'preparing'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'preparing',
      'Order preparation started',
      'business',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order preparation started successfully',
    };
  }

  async completePreparation(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business)
      throw new HttpException(
        'Only business users can complete order preparation',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to complete preparation for this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'preparing')
      throw new HttpException(
        `Cannot complete preparation for order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'ready_for_pickup'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'ready_for_pickup',
      'Order preparation completed, ready for pickup',
      'business',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order preparation completed successfully',
    };
  }

  async claimOrder(request: GetOrderRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can get orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderWithItems(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.current_status !== 'ready_for_pickup')
      throw new HttpException(
        `Cannot get order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // Check if order requires verified agent and if agent is verified
    if (order.verified_agent_delivery && !user.agent.is_verified) {
      throw new HttpException(
        'This order requires a verified agent. Please contact support to get your account verified.',
        HttpStatus.FORBIDDEN
      );
    }
    const holdPercentage = this.configService.get('order').agentHoldPercentage;
    const holdAmount = (order.total_amount * holdPercentage) / 100;
    const agentAccount = await this.hasuraSystemService.getAccount(
      user.id,
      order.currency
    );
    if (!agentAccount)
      throw new HttpException(
        `No account found for currency ${order.currency}`,
        HttpStatus.BAD_REQUEST
      );
    if (agentAccount.available_balance < holdAmount)
      throw new HttpException(
        `Insufficient balance. Required: ${holdAmount} ${order.currency}, Available: ${agentAccount.available_balance} ${order.currency}`,
        HttpStatus.FORBIDDEN
      );

    const orderHold = await this.getOrCreateOrderHold(order.id);

    await this.updateOrderHold(orderHold.id, {
      agent_hold_amount: holdAmount,
      agent_id: user.agent.id,
    });

    await this.accountsService.registerTransaction({
      accountId: agentAccount.id,
      amount: holdAmount,
      transactionType: 'hold',
      memo: `Hold for order ${order.order_number}`,
      referenceId: order.id,
    });

    const updatedOrder = await this.assignOrderToAgent(
      request.orderId,
      user.agent.id,
      'assigned_to_agent'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'assigned_to_agent',
      `Order assigned to agent ${user.first_name} ${user.last_name}`,
      'agent',
      user.id
    );
    return {
      success: true,
      order: updatedOrder,
      holdAmount,
      message: 'Order assigned successfully',
    };
  }

  async pickUpOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can pick up orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
      throw new HttpException(
        'Only the assigned agent can pick up this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'assigned_to_agent')
      throw new HttpException(
        `Cannot pick up order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'picked_up'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'picked_up',
      'Order picked up by agent',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order picked up successfully',
    };
  }

  async startTransit(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can start transit',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
      throw new HttpException(
        'Only the assigned agent can start transit for this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'picked_up')
      throw new HttpException(
        `Cannot start transit for order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'in_transit'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'in_transit',
      'Order in transit to customer',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order transit started successfully',
    };
  }

  async outForDelivery(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can mark orders as out for delivery',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
      throw new HttpException(
        'Only the assigned agent can mark this order as out for delivery',
        HttpStatus.FORBIDDEN
      );
    if (
      order.current_status !== 'in_transit' &&
      order.current_status !== 'picked_up'
    )
      throw new HttpException(
        `Cannot mark order as out for delivery in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'out_for_delivery'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'out_for_delivery',
      'Agent out for delivery to customer',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order marked as out for delivery successfully',
    };
  }

  async deliverOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can deliver orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
      throw new HttpException(
        'Only the assigned agent can deliver this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'out_for_delivery')
      throw new HttpException(
        `Cannot deliver order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'delivered'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'delivered',
      'Order delivered successfully to customer',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order delivered successfully',
    };
  }

  async completeOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.client)
      throw new HttpException(
        'Only client users can complete orders',
        HttpStatus.FORBIDDEN
      );

    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.client_id !== user.client.id)
      throw new HttpException(
        'Only the client can complete this order',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'delivered')
      throw new HttpException(
        `Cannot complete order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    await this.releaseHoldAndProcessPayment(order.id);

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'complete'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'complete',
      'Order completed by client',
      'client',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order completed successfully',
    };
  }

  async failDelivery(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent)
      throw new HttpException(
        'Only agent users can mark deliveries as failed',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.assigned_agent_id !== user.agent.id)
      throw new HttpException(
        'Only the assigned agent can mark this delivery as failed',
        HttpStatus.FORBIDDEN
      );
    if (order.current_status !== 'out_for_delivery')
      throw new HttpException(
        `Cannot mark delivery as failed in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // Release the hold since delivery failed
    await this.releaseOrderHold(order, user.id);

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'failed'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'failed',
      'Delivery failed - customer not available or other issue',
      'agent',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Delivery marked as failed',
    };
  }

  async cancelOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business)
      throw new HttpException(
        'Only business users can cancel orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to cancel this order',
        HttpStatus.FORBIDDEN
      );

    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'confirmed', 'preparing'];
    if (!cancellableStatuses.includes(order.current_status))
      throw new HttpException(
        `Cannot cancel order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    // If order was assigned to agent, release the hold
    if (order.assigned_agent_id) {
      await this.releaseOrderHold(order, order.assigned_agent.user_id);
    }

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'cancelled'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'cancelled',
      'Order cancelled by business',
      'business',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order cancelled successfully',
    };
  }

  async refundOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business)
      throw new HttpException(
        'Only business users can refund orders',
        HttpStatus.FORBIDDEN
      );
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.business.user_id !== user.id)
      throw new HttpException(
        'Unauthorized to refund this order',
        HttpStatus.FORBIDDEN
      );

    // Check if order can be refunded
    const refundableStatuses = ['delivered', 'failed', 'cancelled'];
    if (!refundableStatuses.includes(order.current_status))
      throw new HttpException(
        `Cannot refund order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );

    const updatedOrder = await this.orderStatusService.updateOrderStatus(
      request.orderId,
      'refunded'
    );
    await this.createStatusHistoryEntry(
      request.orderId,
      'refunded',
      'Order refunded by business',
      'business',
      user.id,
      request.notes
    );
    return {
      success: true,
      order: updatedOrder,
      message: 'Order refunded successfully',
    };
  }

  /**
   * Fetch orders for the current user (client, agent, or business) with optional filters
   */
  async getOrders(filters?: any): Promise<any[]> {
    const user = await this.hasuraUserService.getUser();
    let personaFilter: any = {};
    if (user.user_type_id === 'client' && user.client) {
      personaFilter = { client_id: { _eq: user.client.id } };
    } else if (user.user_type_id === 'agent' && user.agent) {
      personaFilter = { assigned_agent_id: { _eq: user.agent.id } };
    } else if (user.user_type_id === 'business' && user.business) {
      personaFilter = { business_id: { _eq: user.business.id } };
    } else {
      throw new HttpException(
        'Invalid user persona for orders query',
        HttpStatus.FORBIDDEN
      );
    }

    // Merge persona filter with any additional filters
    const where = filters ? { _and: [personaFilter, filters] } : personaFilter;

    const query = `
      query GetBusinessOrders($filters: orders_bool_exp) {
        orders(where: $filters, order_by: {created_at: desc}) {
          id
          order_number
          client_id
          business_id
          business_location_id
          assigned_agent_id
          delivery_address_id
          subtotal
          delivery_fee
          tax_amount
          total_amount
          currency
          current_status
          estimated_delivery_time
          actual_delivery_time
          special_instructions
          preferred_delivery_time
          payment_method
          payment_status
          created_at
          updated_at
          client {
            id
            user {
              id
              first_name
              last_name
              email
            }
          }
          business_location {
            id
            name
            location_type
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
          }
          delivery_address {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
          }
          assigned_agent {
            id
            user {
              id
              first_name
              last_name
              email
            }
          }
          order_items {
            id
            item_name
            item_description
            unit_price
            quantity
            total_price
            weight
            item {
              sku
              currency
              model
              color
              size
              size_unit
              weight
              weight_unit
              brand {
                id
                name
              }
              item_sub_category {
                id
                name
                item_category {
                  id
                  name
                }
              }
              item_images {
                id
                image_url
              }
            }
            weight_unit
            dimensions
            special_instructions
          }
          order_status_history {
            changed_by_type
            changed_by_user {
              agent {
                user {
                  email
                  first_name
                  last_name
                }
              }
              business {
                user {
                  email
                  first_name
                  last_name
                }
              }
              client {
                user {
                  first_name
                  email
                  last_name
                }
              }
            }
            changed_by_user_id
            created_at
            id
            previous_status
            status
            notes
          }
        }
      }

    `;

    const variables = { filters: where };
    const result = await this.hasuraSystemService.executeQuery(
      query,
      variables
    );
    return result.orders;
  }

  async getOpenOrders() {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent) {
      throw new HttpException(
        'Only agent users can view open orders',
        HttpStatus.FORBIDDEN
      );
    }
    // Query for orders in ready_for_pickup and assigned_agent_id is null
    const query = `
      query OpenOrders {
        orders(where: {current_status: {_eq: "ready_for_pickup"}, assigned_agent_id: {_is_null: true}}) {
          id
          order_number
          business {
            name
          }
          client {
              user {
                id
                first_name
                last_name
                phone_number
                email
              }
            }
          business_location {
            id
            name
            address {
              address_line_1
              city
              state
              postal_code
            }
          }
          
          delivery_address {
            address_line_1
            city
            state
            postal_code
          }
          total_amount
          currency
          current_status
          verified_agent_delivery
          created_at
          order_items {
            id
            item_name
            item {
              model
              color
              size
              size_unit
              weight
              weight_unit
              brand {
                name
              }
              item_sub_category {
                name
                item_category {
                  name
                }
              }
              item_images {
                image_url
              }
            }
            quantity
            unit_price
            total_price
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query);
    return { success: true, orders: result.orders };
  }

  async dropOrder(request: OrderStatusChangeRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.agent) {
      throw new HttpException(
        'Only agent users can drop orders',
        HttpStatus.FORBIDDEN
      );
    }
    // Get the order and check if assigned to this agent and in assigned_to_agent status
    const order = await this.getOrderDetails(request.orderId);
    if (!order)
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (order.current_status !== 'assigned_to_agent') {
      throw new HttpException(
        'Order is not in assigned_to_agent status',
        HttpStatus.BAD_REQUEST
      );
    }
    if (order.assigned_agent_id !== user.agent.id) {
      throw new HttpException(
        'You are not assigned to this order',
        HttpStatus.FORBIDDEN
      );
    }
    // Clear assigned_agent_id and set status to ready_for_pickup
    const mutation = `
      mutation DropOrder($orderId: uuid!) {
        update_orders_by_pk(pk_columns: {id: $orderId}, _set: {assigned_agent_id: null, current_status: "ready_for_pickup"}) {
          id
          current_status
          assigned_agent_id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      orderId: request.orderId,
    });
    // Add order status history entry
    await this.createStatusHistoryEntry(
      request.orderId,
      'ready_for_pickup',
      'Order dropped by agent and made available for other agents',
      'agent',
      user.id
    );

    const agentAccount = await this.hasuraSystemService.getAccount(
      user.agent.user_id,
      order.currency
    );

    const orderHold = await this.getOrCreateOrderHold(order.id);

    await this.updateOrderHold(orderHold.id, {
      status: 'cancelled',
    });

    await this.accountsService.registerTransaction({
      accountId: agentAccount.id,
      amount: orderHold.agent_hold_amount,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number}. Order dropped by agent and made available for other agents.`,
      referenceId: order.id,
    });
    return {
      success: true,
      order: result.update_orders_by_pk,
      message: 'Order dropped and made available for other agents.',
    };
  }

  private async getOrderDetails(orderId: string): Promise<any> {
    const query = `
      query GetOrder($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          total_amount
          currency
          business_id
          client_id
          client {
            user_id
          }
          business {
            user_id
          }
          assigned_agent_id
          assigned_agent {
            user_id
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });
    return result.orders_by_pk;
  }

  private async getOrderWithItems(orderId: string): Promise<any> {
    const query = `
      query GetOrderWithItems($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          total_amount
          currency
          business_id
          verified_agent_delivery
          business {
            user_id
          }
          assigned_agent_id
          assigned_agent {
            user_id
          }
          order_items {
            id
            total_price
            quantity
            item {
              name
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });
    return result.orders_by_pk;
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
  async createOrder(orderData: any): Promise<any> {
    // Get the current user
    const user = await this.hasuraUserService.getUser();

    if (!user.client) {
      throw new Error('Client not found');
    }

    const address = await this.hasuraUserService.getUserAddress(
      user.id,
      user.user_type_id
    );

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

    const businessInventoryResult = await this.hasuraSystemService.executeQuery(
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

    const fees = await this.hasuraSystemService.getDeliveryFee(
      businessInventory.item.currency
    );

    if (orderData.item.quantity > businessInventory.available_quantity) {
      throw new Error(
        `Insufficient quantity for item ${businessInventory.item.name}. Available: ${businessInventory.available_quantity}, Requested: ${orderData.item.quantity}`
      );
    }

    const totalAmount =
      businessInventory.selling_price * orderData.item.quantity;
    const currency = businessInventory.item.currency;

    // Check user account for the currency
    const account = await this.hasuraSystemService.getAccount(
      user.id,
      currency
    );

    if (!account) {
      throw new Error(`No account found for currency ${currency}`);
    }

    if (account.total_balance < totalAmount + fees) {
      throw new Error(
        `Insufficient funds for currency ${currency}. Required: ${
          totalAmount + fees
        }, Available: ${account.total_balance}`
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
    const special_instructions = orderData.special_instructions || '';
    const estimated_delivery_time = null;
    const preferred_delivery_time = null;
    const actual_delivery_time = null;
    const assigned_agent_id = null;
    const verified_agent_delivery = !!orderData.verified_agent_delivery;

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
        $verifiedAgentDelivery: Boolean!
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
          verified_agent_delivery: $verifiedAgentDelivery,
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
    const orderResult = await this.hasuraSystemService.executeMutation(
      createOrderMutation,
      {
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
        verifiedAgentDelivery: verified_agent_delivery,
      }
    );

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
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(
      createStatusHistoryMutation,
      {
        orderId: order.id,
        status: 'pending',
        notes: 'Order created',
        changedByType: 'client',
        changedByUserId: user.id,
      }
    );

    await this.accountsService.registerTransaction({
      accountId: account.id,
      amount: totalAmount,
      transactionType: 'hold',
      memo: `Hold for order ${order.order_number}`,
      referenceId: order.id,
    });

    await this.accountsService.registerTransaction({
      accountId: account.id,
      amount: fees,
      transactionType: 'hold',
      memo: `Hold for order ${order.order_number} delivery fee`,
      referenceId: order.id,
    });
    const orderHold = await this.getOrCreateOrderHold(order.id);

    await this.updateOrderHold(orderHold.id, {
      client_hold_amount: totalAmount,
      delivery_fees: fees,
    });

    return {
      ...order,
      total_amount: totalAmount,
    };
  }

  /**
   * Get or create an order hold for the given order ID
   */
  private async getOrCreateOrderHold(
    orderId: string,
    deliveryFees: number = 0
  ): Promise<any> {
    // First, try to get the existing order hold
    const getOrderHoldQuery = `
      query GetOrderHold($orderId: uuid!) {
        order_holds(where: { order_id: { _eq: $orderId } }) {
          id
          order_id
          client_id
          agent_id
          client_hold_amount
          agent_hold_amount
          delivery_fees
          currency
          status
          created_at
          updated_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(
      getOrderHoldQuery,
      {
        orderId,
      }
    );

    let orderHold = result.order_holds[0] || null;

    if (!orderHold) {
      // Get order details to create the order hold
      const order = await this.getOrderDetails(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Create a new order hold
      const createOrderHoldMutation = `
        mutation CreateOrderHold(
          $orderId: uuid!,
          $clientId: uuid!,
          $currency: currency_enum!,
          $clientHoldAmount: numeric!,
          $deliveryFees: numeric!
        ) {
          insert_order_holds_one(object: {
            order_id: $orderId,
            client_id: $clientId,
            agent_id: null,
            client_hold_amount: $clientHoldAmount,
            agent_hold_amount: 0,
            delivery_fees: $deliveryFees,
            currency: $currency,
            status: "active"
          }) {
            id
            order_id
            client_id
            agent_id
            client_hold_amount
            agent_hold_amount
            delivery_fees
            currency
            status
            created_at
            updated_at
          }
        }
      `;

      const createResult = await this.hasuraSystemService.executeMutation(
        createOrderHoldMutation,
        {
          orderId: order.id,
          clientId: order.client_id,
          currency: order.currency,
          clientHoldAmount: order.total_amount,
          deliveryFees: deliveryFees ?? 0,
        }
      );

      orderHold = createResult.insert_order_holds_one;
    }

    return orderHold;
  }

  /**
   * Update an order hold with the specified fields
   */
  private async updateOrderHold(
    orderHoldId: string,
    updates: {
      status?: string;
      client_hold_amount?: number;
      agent_hold_amount?: number;
      delivery_fees?: number;
      agent_id?: string | null;
    }
  ): Promise<any> {
    const updateOrderHoldMutation = `
     mutation UpdateOrderHold($orderHoldId: uuid!, $_set: order_holds_set_input = {}) {
      update_order_holds_by_pk(pk_columns: {id: $orderHoldId}, _set: $_set) {
        id
        order_id
        client_id
        agent_id
        client_hold_amount
        agent_hold_amount
        delivery_fees
        currency
        status
        created_at
        updated_at
      }
    }

    `;

    const result = await this.hasuraSystemService.executeMutation(
      updateOrderHoldMutation,
      {
        orderHoldId,
        _set: {
          status: updates.status ?? undefined,
          client_hold_amount: updates.client_hold_amount ?? undefined,
          agent_hold_amount: updates.agent_hold_amount ?? undefined,
          delivery_fees: updates.delivery_fees ?? undefined,
          agent_id: updates.agent_id ?? undefined,
        },
      }
    );

    return result.update_order_holds_by_pk;
  }

  private async assignOrderToAgent(
    orderId: string,
    agentId: string,
    status: string
  ): Promise<any> {
    const mutation = `
      mutation AssignOrderToAgent($orderId: uuid!, $agentId: uuid!, $status: order_status!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { 
            current_status: $status,
            assigned_agent_id: $agentId,
            updated_at: "now()"
          }
        ) {
          id
          order_number
          current_status
          assigned_agent_id
          updated_at
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      agentId,
      status,
    });
    return result.update_orders_by_pk;
  }

  private async createStatusHistoryEntry(
    orderId: string,
    status: string,
    notes: string,
    changedByType: string,
    changedByUserId: string,
    additionalNotes?: string
  ): Promise<void> {
    const finalNotes = additionalNotes ? `${notes}. ${additionalNotes}` : notes;
    const mutation = `
      mutation CreateStatusHistory($orderId: uuid!, $status: order_status!, $notes: String!, $changedByType: String!, $changedByUserId: uuid!) {
        insert_order_status_history(objects: [{
          order_id: $orderId,
          status: $status,
          notes: $notes,
          changed_by_type: $changedByType,
          changed_by_user_id: $changedByUserId
        }]) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      status,
      notes: finalNotes,
      changedByType,
      changedByUserId,
    });
  }

  private async releaseOrderHold(order: any, userId: string) {
    const agentAccount = await this.hasuraSystemService.getAccount(
      userId,
      order.currency
    );
    if (!agentAccount) return;

    const holdPercentage = this.configService.get('order').agentHoldPercentage;
    const holdAmount = (order.total_amount * holdPercentage) / 100;

    await this.accountsService.registerTransaction({
      accountId: agentAccount.id,
      amount: holdAmount,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number}`,
      referenceId: order.id,
    });
  }

  private async releaseHoldAndProcessPayment(
    referenceId: string
  ): Promise<void> {
    const order = await this.getOrderDetails(referenceId);

    if (
      !order ||
      !order.business ||
      !order.business.user_id ||
      !order.client_id
    ) {
      throw new Error('Order, business user, or client not found');
    }

    const orderHold = await this.getOrCreateOrderHold(referenceId);

    const agentAccount = await this.hasuraSystemService.getAccount(
      order.assigned_agent.user_id,
      order.currency
    );

    await this.accountsService.registerTransaction({
      accountId: agentAccount.id,
      amount: orderHold.agent_hold_amount,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number}`,
      referenceId: referenceId,
    });

    await this.accountsService.registerTransaction({
      accountId: agentAccount.id,
      amount: orderHold.delivery_fees,
      transactionType: 'deposit',
      memo: `Delivery fee received for order ${order.order_number}`,
      referenceId: referenceId,
    });

    const clientAccount = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );

    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: orderHold.client_hold_amount,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number}`,
      referenceId: referenceId,
    });

    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: orderHold.delivery_fees,
      transactionType: 'release',
      memo: `Hold released for order ${order.order_number} delivery fee`,
      referenceId: referenceId,
    });

    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: order.total_amount,
      transactionType: 'payment',
      memo: `Order payment received for order ${order.order_number}`,
      referenceId: referenceId,
    });

    const businessUserId = order.business.user_id;
    const currency = order.currency;

    // 5. Get the business account for the order's currency
    let businessAccount = await this.hasuraSystemService.getAccount(
      businessUserId,
      currency
    );

    await this.accountsService.registerTransaction({
      accountId: businessAccount.id,
      amount: order.total_amount,
      transactionType: 'deposit',
      memo: `Order payment received for order ${order.order_number}`,
      referenceId: referenceId,
    });

    await this.updateOrderHold(orderHold.id, {
      status: 'completed',
    });
  }
}
