import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  NotificationData,
  NotificationsService,
} from '../notifications/notifications.service';
import { OrderQueueService } from './order-queue.service';
import { isActivePersona } from '../users/persona.util';

@Injectable()
export class OrderStatusService {
  private readonly logger = new Logger(OrderStatusService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly orderQueueService: OrderQueueService
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

    // Validate user permissions (ownership via order graph; active persona via user_type_id)
    const isBusinessOwner =
      isActivePersona(user, 'business') &&
      order.business.user_id === user.id;
    const isAssignedAgent = !!(
      order.assigned_agent_id &&
      order.assigned_agent.user_id === user.id
    );
    const isAnyAgent = isActivePersona(user, 'agent');
    const isClient =
      isActivePersona(user, 'client') &&
      order.client?.user_id === user.id;

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

    const previousStatus = order.current_status;
    const assignToAgent =
      previousStatus === 'ready_for_pickup' &&
      newStatus === 'assigned_to_agent' &&
      isAnyAgent;
    let agentIdForAssign: string | undefined;
    if (assignToAgent) {
      if (!user.agent?.id) {
        throw new Error('Agent record required to assign order');
      }
      agentIdForAssign = user.agent.id;
    }
    const { mutation: updateOrderMutation, variables: mutationVariables } =
      this.buildConditionalStatusMutation(
        orderId,
        previousStatus,
        newStatus,
        assignToAgent,
        agentIdForAssign
      );

    const updateResult = await this.hasuraSystemService.executeMutation<{
      update_orders: { affected_rows: number; returning: any[] };
    }>(updateOrderMutation, mutationVariables);

    const batch = updateResult.update_orders;
    this.ensureSingleStatusRowUpdated(
      batch?.affected_rows,
      previousStatus,
      newStatus
    );
    const updatedRow = batch.returning[0];

    // Send status change notifications
    try {
      const orderDetails = await this.getOrderDetailsForNotification(orderId);

      if (orderDetails) {
        // Check if notifications are enabled
        const notificationsEnabled =
          this.configService.get('notification').orderStatusChangeEnabled;

        if (notificationsEnabled) {
          await this.notificationsService.sendOrderStatusChangeNotifications(
            orderDetails,
            previousStatus
          );
        } else {
          this.logger.log(
            `Order status change notifications disabled for order ${orderId} (${previousStatus} → ${newStatus})`
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send status change notifications: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't fail the status update if notifications fail
    }

    // Send order.status.updated message to SQS queue (except when changing to complete)
    if (newStatus !== 'complete') {
      try {
        await this.orderQueueService.sendOrderStatusUpdatedMessage(
          orderId,
          newStatus
        );
      } catch (error) {
        // Log but don't throw - status update should succeed
        this.logger.error(
          `Failed to send order.status.updated message to SQS: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return updatedRow;
  }

  private buildConditionalStatusMutation(
    orderId: string,
    previousStatus: string,
    newStatus: string,
    assignToAgent: boolean,
    agentId?: string
  ): { mutation: string; variables: Record<string, string> } {
    if (assignToAgent) {
      if (!agentId) {
        throw new Error('Agent id required for assign mutation');
      }
      return {
        mutation: `
        mutation UpdateOrderStatusConditional(
          $orderId: uuid!
          $previousStatus: order_status!
          $newStatus: order_status!
          $agentId: uuid!
        ) {
          update_orders(
            where: {
              id: { _eq: $orderId }
              current_status: { _eq: $previousStatus }
            }
            _set: {
              current_status: $newStatus
              assigned_agent_id: $agentId
              updated_at: "now()"
            }
          ) {
            affected_rows
            returning {
              id
              order_number
              current_status
              assigned_agent_id
              updated_at
            }
          }
        }
      `,
        variables: {
          orderId,
          previousStatus,
          newStatus,
          agentId,
        },
      };
    }
    return {
      mutation: `
        mutation UpdateOrderStatusConditional(
          $orderId: uuid!
          $previousStatus: order_status!
          $newStatus: order_status!
        ) {
          update_orders(
            where: {
              id: { _eq: $orderId }
              current_status: { _eq: $previousStatus }
            }
            _set: {
              current_status: $newStatus
              updated_at: "now()"
            }
          ) {
            affected_rows
            returning {
              id
              order_number
              current_status
              updated_at
            }
          }
        }
      `,
      variables: {
        orderId,
        previousStatus,
        newStatus,
      },
    };
  }

  private ensureSingleStatusRowUpdated(
    affectedRows: number | undefined,
    previousStatus: string,
    newStatus: string
  ): void {
    if (affectedRows === 1) {
      return;
    }
    this.logger.warn(
      `Conditional order status update affected ${affectedRows ?? 0} row(s): ${previousStatus} → ${newStatus}`
    );
    throw new HttpException(
      'Order status already changed. Please refresh and try again.',
      HttpStatus.CONFLICT
    );
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
      pending_payment: isClient
        ? ['pending', 'cancelled']
        : isBusinessOwner
        ? ['cancelled']
        : [],
      pending: isBusinessOwner
        ? ['confirmed', 'cancelled']
        : isClient
        ? ['cancelled']
        : [],
      confirmed: isBusinessOwner
        ? ['ready_for_pickup', 'cancelled']
        : isClient
        ? ['cancelled']
        : [],
      preparing: isBusinessOwner ? ['ready_for_pickup', 'cancelled'] : [],
      ready_for_pickup: isAssignedAgent ? ['assigned_to_agent'] : [],
      assigned_to_agent: isAssignedAgent ? ['picked_up'] : [],
      picked_up: isAssignedAgent ? ['in_transit', 'out_for_delivery'] : [],
      in_transit: isAssignedAgent ? ['out_for_delivery'] : [],
      out_for_delivery: isAssignedAgent ? ['complete', 'failed'] : [],
      delivered: isClient ? ['complete'] : [],
      cancelled: [],
      failed: [],
      refunded: [],
    };

    return transitions[currentStatus] || [];
  }

  /**
   * Get order details for notification purposes
   */
  async getOrderDetailsForNotification(
    orderId: string
  ): Promise<NotificationData | null> {
    try {
      // Fetch order with all related data for notifications
      const query = `
        query GetOrderForNotification($orderId: uuid!) {
          orders_by_pk(id: $orderId) {
            id
            order_number
            current_status
            subtotal
            base_delivery_fee
            per_km_delivery_fee
            tax_amount
            total_amount
            currency
            estimated_delivery_time
            special_instructions
            delivery_time_window_id
            client {
              user {
                first_name
                last_name
                email
                preferred_language
              }
            }
            business {
              name
              is_verified
              user {
                email
                preferred_language
              }
            }
            assigned_agent {
              user {
                first_name
                last_name
                email
                preferred_language
              }
            }
            delivery_address {
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
              instructions
            }
            order_items {
              item_name
              quantity
              unit_price
              total_price
            }
            delivery_time_windows(where: { is_confirmed: { _eq: true } }, limit: 1, order_by: { created_at: desc }) {
              id
              preferred_date
              time_slot_start
              time_slot_end
              special_instructions
              slot {
                slot_name
                slot_type
              }
            }
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query, {
        orderId,
      });
      const order = result.orders_by_pk;

      if (!order) {
        this.logger.warn(`Order not found for notification: ${orderId}`);
        return null;
      }

      // Format delivery window details if available
      let deliveryTimeWindow: string | undefined;
      if (
        order.delivery_time_windows &&
        order.delivery_time_windows.length > 0
      ) {
        const window = order.delivery_time_windows[0];
        const windowDate = new Date(window.preferred_date);
        const formattedDate = windowDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const formatTime = (time: string) => {
          const [hours, minutes] = time.split(':');
          const hour = parseInt(hours, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${ampm}`;
        };
        const timeRange = `${formatTime(window.time_slot_start)} - ${formatTime(
          window.time_slot_end
        )}`;
        const slotName = window.slot?.slot_name || '';
        deliveryTimeWindow = `${formattedDate}, ${timeRange}${
          slotName ? ` (${slotName})` : ''
        }`;
        if (window.special_instructions) {
          deliveryTimeWindow += ` - ${window.special_instructions}`;
        }
      }

      // Safely extract client information with null checks
      const clientName = order.client?.user
        ? `${order.client.user.first_name || ''} ${
            order.client.user.last_name || ''
          }`.trim() || 'Unknown Client'
        : 'Unknown Client';
      const clientEmail = order.client?.user?.email || '';

      // Safely extract business information with null checks
      const businessName = order.business?.name || 'Unknown Business';
      const businessEmail = order.business?.user?.email || '';
      const businessVerified = order.business?.is_verified || false;

      // Safely extract agent information with null checks
      const agentName = order.assigned_agent?.user
        ? `${order.assigned_agent.user.first_name || ''} ${
            order.assigned_agent.user.last_name || ''
          }`.trim() || undefined
        : undefined;
      const agentEmail = order.assigned_agent?.user?.email;

      return {
        orderId: order.id,
        orderNumber: order.order_number,
        clientName,
        clientEmail,
        clientPreferredLanguage: order.client?.user?.preferred_language,
        businessName,
        businessEmail,
        businessPreferredLanguage: order.business?.user?.preferred_language,
        businessVerified,
        agentName,
        agentEmail,
        agentPreferredLanguage: order.assigned_agent?.user?.preferred_language,
        orderStatus: order.current_status,
        orderItems: (order.order_items || []).map((item: any) => ({
          name: item.item_name || 'Unknown Item',
          quantity: item.quantity || 0,
          unitPrice: item.unit_price || 0,
          totalPrice: item.total_price || 0,
        })),
        subtotal: order.subtotal || 0,
        deliveryFee:
          (order.base_delivery_fee || 0) + (order.per_km_delivery_fee || 0),
        taxAmount: order.tax_amount || 0,
        totalAmount: order.total_amount || 0,
        currency: order.currency || 'USD',
        deliveryAddress: this.formatAddress(order.delivery_address),
        estimatedDeliveryTime:
          deliveryTimeWindow || order.estimated_delivery_time,
        specialInstructions: order.special_instructions,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get order details for notification: ${orderId}`,
        error.stack || error.message
      );
      // Return null instead of throwing to prevent breaking the order status update
      return null;
    }
  }

  /**
   * Format address fields into a single formatted address string
   */
  private formatAddress(address: any): string {
    if (!address) {
      return '';
    }

    const addressParts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter((part) => part && part.trim() !== '');

    return addressParts.join(', ');
  }
}
