import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

@Injectable()
export class OrderStatusService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  /**
   * Update order status with validation for business workflow
   */
  async updateOrderStatus(orderId: string, newStatus: string): Promise<any> {
    // Get the current user
    const user = await this.hasuraUserService.getUser();

    // Get the order to validate ownership and current status
    const getOrderQuery = `
      query GetOrder($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          business_id
          business {
            user_id
          }
          assigned_agent_id
          assigned_agent {
            user_id
          }
          client_id
          client {
            user_id
          }
        }
      }
    `;

    const orderResult = await this.hasuraSystemService.executeQuery(
      getOrderQuery,
      { orderId }
    );
    const order = orderResult.orders_by_pk;

    if (!order) {
      throw new Error('Order not found');
    }

    // Validate user permissions
    const isBusinessOwner = !!(
      user.business && order.business.user_id === user.id
    );
    const isAssignedAgent = !!(
      user.agent &&
      order.assigned_agent_id &&
      order.assigned_agent.user_id === user.id
    );
    const isAnyAgent = !!user.agent;
    const isClient = user.client?.id === order.client_id;

    // Special case: Agent can assign ready_for_pickup orders to themselves
    if (
      order.current_status === 'ready_for_pickup' &&
      newStatus === 'assigned_to_agent' &&
      isAnyAgent
    ) {
      // This is allowed - agent is assigning order to themselves
    } else if (!isBusinessOwner && !isAssignedAgent && !isClient) {
      throw new Error('Unauthorized to update this order');
    }

    // Validate status transitions based on user type and current status
    const validTransitions = this.getValidStatusTransitions(
      order.current_status,
      isBusinessOwner,
      isAssignedAgent,
      isClient
    );

    // Special case: Any agent can assign ready_for_pickup orders
    if (
      order.current_status === 'ready_for_pickup' &&
      newStatus === 'assigned_to_agent' &&
      isAnyAgent
    ) {
      // This transition is allowed
    } else if (!validTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${order.current_status} to ${newStatus}`
      );
    }

    // Update order status
    let updateOrderMutation: string;
    let mutationVariables: any;

    if (
      order.current_status === 'ready_for_pickup' &&
      newStatus === 'assigned_to_agent' &&
      isAnyAgent
    ) {
      // Special case: Assign order to agent and update status
      updateOrderMutation = `
        mutation UpdateOrderStatus($orderId: uuid!, $newStatus: order_status!, $agentId: uuid!) {
          update_orders_by_pk(
            pk_columns: { id: $orderId }
            _set: { 
              current_status: $newStatus,
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
      mutationVariables = {
        orderId,
        newStatus,
        agentId: user.agent!.id,
      };
    } else {
      // Regular status update
      updateOrderMutation = `
        mutation UpdateOrderStatus($orderId: uuid!, $newStatus: order_status!) {
          update_orders_by_pk(
            pk_columns: { id: $orderId }
            _set: { 
              current_status: $newStatus,
              updated_at: "now()"
            }
          ) {
            id
            order_number
            current_status
            updated_at
          }
        }
      `;
      mutationVariables = {
        orderId,
        newStatus,
      };
    }

    const updateResult = await this.hasuraSystemService.executeMutation(
      updateOrderMutation,
      mutationVariables
    );

    return updateResult.update_orders_by_pk;
  }

  /**
   * Get valid status transitions based on current status and user type
   */
  private getValidStatusTransitions(
    currentStatus: string,
    isBusinessOwner: boolean,
    isAssignedAgent: boolean,
    isClient: boolean
  ): string[] {
    const transitions: { [key: string]: string[] } = {
      pending: isBusinessOwner ? ['confirmed', 'cancelled'] : [],
      confirmed: isBusinessOwner ? ['preparing', 'cancelled'] : [],
      preparing: isBusinessOwner ? ['ready_for_pickup', 'cancelled'] : [],
      ready_for_pickup: isAssignedAgent ? ['assigned_to_agent'] : [],
      assigned_to_agent: isAssignedAgent ? ['picked_up'] : [],
      picked_up: isAssignedAgent ? ['in_transit', 'out_for_delivery'] : [],
      in_transit: isAssignedAgent ? ['out_for_delivery'] : [],
      out_for_delivery: isAssignedAgent ? ['delivered', 'failed'] : [],
      delivered: isClient ? ['complete'] : [],
      cancelled: [],
      failed: [],
      refunded: [],
    };

    return transitions[currentStatus] || [];
  }
}
