import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

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
    private readonly configService: ConfigService<Configuration>
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
    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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
    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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
    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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

  async getOrder(request: GetOrderRequest) {
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
    await this.placeHoldOnAccount(
      agentAccount.id,
      holdAmount,
      `Hold for order ${order.order_number}`,
      order.id
    );
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
    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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
    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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
    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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

    // Release the hold and process payment
    await this.processOrderDelivery(order, user.id);

    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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

    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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

    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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

    const updatedOrder = await this.hasuraUserService.updateOrderStatus(
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
        orders(where: $filters, order_by: { created_at: desc }) {
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
    const order = await this.hasuraUserService.executeQuery(
      `
      query GetOrder($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          assigned_agent_id
          current_status
        }
      }
    `,
      { orderId: request.orderId }
    );
    const o = order.orders_by_pk;
    if (!o) throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    if (o.current_status !== 'assigned_to_agent') {
      throw new HttpException(
        'Order is not in assigned_to_agent status',
        HttpStatus.BAD_REQUEST
      );
    }
    if (o.assigned_agent_id !== user.agent.id) {
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
    return {
      success: true,
      order: result.update_orders_by_pk,
      message: 'Order dropped and made available for other agents.',
    };
  }

  async claimOrder(request: GetOrderRequest) {
    // Just call the old getOrder logic
    return this.getOrder(request);
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
   * Get account by accountId (returns available_balance and withheld_balance)
   */
  private async getAccountById(
    accountId: string
  ): Promise<{ available_balance: number; withheld_balance: number }> {
    const getAccountQuery = `
      query ($accountId: uuid!) {
        accounts_by_pk(id: $accountId) {
          available_balance
          withheld_balance
        }
      }
    `;
    const accountResult = await this.hasuraSystemService.executeQuery(
      getAccountQuery,
      { accountId }
    );
    const account = accountResult.accounts_by_pk;
    if (!account) throw new Error('Account not found');
    return {
      available_balance: Number(account.available_balance),
      withheld_balance: Number(account.withheld_balance),
    };
  }

  private async placeHoldOnAccount(
    accountId: string,
    amount: number,
    memo: string,
    referenceId: string
  ): Promise<void> {
    // 1. Insert the hold transaction
    const insertTransactionMutation = `
      mutation ($accountId: uuid!, $amount: numeric!, $memo: String!, $referenceId: uuid!) {
        insert_account_transactions(objects: [{
          account_id: $accountId,
          amount: $amount,
          transaction_type: "hold",
          memo: $memo,
          reference_id: $referenceId
        }]) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(insertTransactionMutation, {
      accountId,
      amount,
      memo,
      referenceId,
    });

    // 2. Query the current balances using the reusable method
    const account = await this.getAccountById(accountId);

    // 3. Calculate new balances
    const newAvailable = account.available_balance - Number(amount);
    const newWithheld = account.withheld_balance + Number(amount);

    // 4. Update the account using _set
    const updateAccountMutation = `
      mutation ($accountId: uuid!, $available: numeric!, $withheld: numeric!) {
        update_accounts_by_pk(
          pk_columns: { id: $accountId },
          _set: {
            available_balance: $available,
            withheld_balance: $withheld
          }
        ) {
          id
          available_balance
          withheld_balance
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(updateAccountMutation, {
      accountId,
      available: newAvailable,
      withheld: newWithheld,
    });
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

  private async processOrderDelivery(order: any, userId: string) {
    const agentAccount = await this.hasuraSystemService.getAccount(
      userId,
      order.currency
    );
    if (!agentAccount) return;

    const holdPercentage = this.configService.get('order').agentHoldPercentage;
    const holdAmount = (order.total_amount * holdPercentage) / 100;

    // Release hold and process payment
    await this.releaseHoldAndProcessPayment(
      agentAccount.id,
      holdAmount,
      order.total_amount,
      `Payment for delivered order ${order.order_number}`,
      order.id
    );
  }

  private async releaseOrderHold(order: any, userId: string) {
    const agentAccount = await this.hasuraSystemService.getAccount(
      userId,
      order.currency
    );
    if (!agentAccount) return;

    const holdPercentage = this.configService.get('order').agentHoldPercentage;
    const holdAmount = (order.total_amount * holdPercentage) / 100;

    // Release hold
    await this.releaseHold(
      agentAccount.id,
      holdAmount,
      `Hold released for order ${order.order_number}`,
      order.id
    );
  }

  private async releaseHoldAndProcessPayment(
    accountId: string,
    holdAmount: number,
    paymentAmount: number,
    memo: string,
    referenceId: string
  ): Promise<void> {
    // 1. Insert the release and payment transactions for the agent
    const insertTransactionsMutation = `
      mutation ProcessDelivery($accountId: uuid!, $holdAmount: numeric!, $paymentAmount: numeric!, $memo: String!, $referenceId: uuid!) {
        insert_account_transactions(objects: [
          {
            account_id: $accountId,
            amount: $holdAmount,
            transaction_type: "release",
            memo: "Hold released for delivery",
            reference_id: $referenceId
          },
          {
            account_id: $accountId,
            amount: $paymentAmount,
            transaction_type: "payment",
            memo: $memo,
            reference_id: $referenceId
          }
        ]) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(insertTransactionsMutation, {
      accountId,
      holdAmount,
      paymentAmount,
      memo,
      referenceId,
    });

    // 2. Get the current agent account balances
    const agentAccount = await this.getAccountById(accountId);
    const newWithheld = agentAccount.withheld_balance - Number(holdAmount);
    const newAvailable = agentAccount.available_balance + Number(holdAmount);

    // 3. Update the agent account using _set
    const updateAgentAccountMutation = `
      mutation ($accountId: uuid!, $available: numeric!, $withheld: numeric!) {
        update_accounts_by_pk(
          pk_columns: { id: $accountId },
          _set: {
            available_balance: $available,
            withheld_balance: $withheld
          }
        ) {
          id
          available_balance
          withheld_balance
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(updateAgentAccountMutation, {
      accountId,
      available: newAvailable,
      withheld: newWithheld,
    });

    // 3.5. Release the hold on the client (decrement withheld_balance by the order amount, do not credit available_balance)
    // Get the order details to find the client user and currency
    const order = await this.getOrderDetails(referenceId);
    if (
      !order ||
      !order.business ||
      !order.business.user_id ||
      !order.client_id
    ) {
      throw new Error('Order, business user, or client not found');
    }

    const clientAccount = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );

    if (clientAccount && clientAccount.withheld_balance > 0) {
      const newWithheld =
        clientAccount.withheld_balance - Number(order.total_amount);
      const updateClientAccountMutation = `
        mutation ($accountId: uuid!, $withheld_balance: numeric!) {
          update_accounts_by_pk(
            pk_columns: { id: $accountId },
            _set: { withheld_balance: $withheld_balance }
          ) {
            id
            withheld_balance
          }
        }
      `;
      await this.hasuraSystemService.executeMutation(
        updateClientAccountMutation,
        {
          accountId: clientAccount.id,
          withheld_balance: newWithheld < 0 ? 0 : newWithheld,
        }
      );
    }

    const businessUserId = order.business.user_id;
    const currency = order.currency;

    // 5. Get the business account for the order's currency
    let businessAccount = await this.hasuraSystemService.getAccount(
      businessUserId,
      currency
    );
    if (!businessAccount) {
      // If the business account for the given currency is not found, create one
      businessAccount = await this.hasuraSystemService.createUserAccount(
        businessUserId,
        currency
      );
      if (!businessAccount) {
        throw new Error('Failed to create business account');
      }
    }

    // 6. Insert a transaction to increment the business's available_balance
    const businessTransactionMutation = `
      mutation ($accountId: uuid!, $amount: numeric!, $memo: String!, $referenceId: uuid!) {
        insert_account_transactions(objects: [{
          account_id: $accountId,
          amount: $amount,
          transaction_type: "payment",
          memo: $memo,
          reference_id: $referenceId
        }]) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(
      businessTransactionMutation,
      {
        accountId: businessAccount.id,
        amount: paymentAmount,
        memo: `Order payment received for order ${order.order_number}`,
        referenceId,
      }
    );

    // 7. Update the business account's available_balance
    const businessAccountBalances = await this.getAccountById(
      businessAccount.id
    );
    const newBusinessAvailable =
      businessAccountBalances.available_balance + Number(paymentAmount);
    const updateBusinessAccountMutation = `
      mutation ($accountId: uuid!, $available: numeric!) {
        update_accounts_by_pk(
          pk_columns: { id: $accountId },
          _set: {
            available_balance: $available
          }
        ) {
          id
          available_balance
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(
      updateBusinessAccountMutation,
      {
        accountId: businessAccount.id,
        available: newBusinessAvailable,
      }
    );
  }

  private async releaseHold(
    accountId: string,
    amount: number,
    memo: string,
    referenceId: string
  ): Promise<void> {
    // 1. Get the current account balances
    const account = await this.getAccountById(accountId);
    const newAvailable = account.available_balance + Number(amount);
    const newWithheld = account.withheld_balance - Number(amount);

    // 2. Insert the release transaction
    const insertTransactionMutation = `
      mutation ReleaseHold($accountId: uuid!, $amount: numeric!, $memo: String!, $referenceId: uuid!) {
        insert_account_transactions(objects: [{
          account_id: $accountId,
          amount: $amount,
          transaction_type: "release",
          memo: $memo,
          reference_id: $referenceId
        }]) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(insertTransactionMutation, {
      accountId,
      amount,
      memo,
      referenceId,
    });

    // 3. Update the account using _set
    const updateAccountMutation = `
      mutation ($accountId: uuid!, $available: numeric!, $withheld: numeric!) {
        update_accounts_by_pk(
          pk_columns: { id: $accountId },
          _set: {
            available_balance: $available,
            withheld_balance: $withheld
          }
        ) {
          id
          available_balance
          withheld_balance
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(updateAccountMutation, {
      accountId,
      available: newAvailable,
      withheld: newWithheld,
    });
  }
}
