import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrdersService } from './orders.service';

export interface ResolutionRequest {
  resolution_type: 'agent_fault' | 'client_fault' | 'item_fault';
  outcome: string; // Required text description
  restore_inventory?: boolean; // Optional, only for item_fault (default: true)
}

@Injectable()
export class FailedDeliveriesService {
  private readonly logger = new Logger(FailedDeliveriesService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly accountsService: AccountsService,
    private readonly ordersService: OrdersService,
    private readonly deliveryConfigService: DeliveryConfigService
  ) {}

  /**
   * Get all active failure reasons
   * @param language Language code ('en' or 'fr'), defaults to 'fr'
   */
  async getFailureReasons(language: 'en' | 'fr' = 'fr') {
    const query = `
      query GetFailureReasons {
        delivery_failure_reasons(
          where: { is_active: { _eq: true } }
          order_by: { sort_order: asc }
        ) {
          id
          reason_key
          reason_en
          reason_fr
          is_active
          sort_order
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {});

    return result.delivery_failure_reasons.map((reason: any) => ({
      id: reason.id,
      reason_key: reason.reason_key,
      reason: language === 'fr' ? reason.reason_fr : reason.reason_en,
      reason_en: reason.reason_en,
      reason_fr: reason.reason_fr,
      is_active: reason.is_active,
      sort_order: reason.sort_order,
    }));
  }

  /**
   * Get failed deliveries for a business
   */
  async getFailedDeliveries(
    businessId: string,
    filters?: {
      status?: 'pending' | 'completed';
      resolution_type?: 'agent_fault' | 'client_fault' | 'item_fault';
    }
  ) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business || user.business.id !== businessId) {
      throw new HttpException(
        'Access denied. You can only view failed deliveries for your own business.',
        HttpStatus.FORBIDDEN
      );
    }

    const variables: any = { businessId };
    const whereConditions: string[] = [
      `order: {business_id: {_eq: $businessId}}`,
    ];

    if (filters?.status) {
      whereConditions.push(`status: {_eq: $status}`);
      variables.status = filters.status;
    }

    if (filters?.resolution_type) {
      whereConditions.push(`resolution_type: {_eq: $resolutionType}`);
      variables.resolutionType = filters.resolution_type;
    }

    const whereClause = `{${whereConditions.join(', ')}}`;

    const query = `
      query GetFailedDeliveries($businessId: uuid!, $status: failed_delivery_status_enum, $resolutionType: failed_delivery_resolution_type_enum) {
        failed_deliveries(
          where: ${whereClause}
          order_by: { created_at: desc }
        ) {
          id
          order_id
          failure_reason_id
          notes
          status
          resolution_type
          outcome
          resolved_by
          resolved_at
          created_at
          updated_at
          order {
            id
            order_number
            current_status
            total_amount
            currency
            business_id
            created_at
            client {
              id
              user {
                id
                first_name
                last_name
                email
              }
            }
            business {
              id
              user_id
            }
            assigned_agent {
              id
              user {
                id
                first_name
                last_name
              }
            }
          }
          failure_reason {
            id
            reason_key
            reason_en
            reason_fr
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(
      query,
      variables
    );
    return result.failed_deliveries || [];
  }

  /**
   * Get a specific failed delivery by order ID
   */
  async getFailedDelivery(orderId: string) {
    const query = `
      query GetFailedDelivery($orderId: uuid!) {
        failed_deliveries(where: { order_id: { _eq: $orderId } }) {
          id
          order_id
          failure_reason_id
          notes
          status
          resolution_type
          outcome
          resolved_by
          resolved_at
          created_at
          updated_at
          order {
            id
            order_number
            current_status
            total_amount
            currency
            business_id
            created_at
            client {
              id
              user {
                id
                first_name
                last_name
                email
              }
            }
            business {
              id
              user_id
            }
            assigned_agent {
              id
              user {
                id
                first_name
                last_name
              }
            }
            order_items {
              id
              business_inventory_id
              quantity
            }
            delivery_address {
              id
              country
            }
          }
          failure_reason {
            id
            reason_key
            reason_en
            reason_fr
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });

    if (!result.failed_deliveries || result.failed_deliveries.length === 0) {
      throw new HttpException(
        'Failed delivery not found',
        HttpStatus.NOT_FOUND
      );
    }

    const failedDelivery = result.failed_deliveries[0];

    // Verify business ownership
    const user = await this.hasuraUserService.getUser();
    if (
      !user.business ||
      failedDelivery.order.business_id !== user.business.id
    ) {
      throw new HttpException(
        'Access denied. You can only view failed deliveries for your own business.',
        HttpStatus.FORBIDDEN
      );
    }

    return failedDelivery;
  }

  /**
   * Resolve a failed delivery
   */
  async resolveFailedDelivery(orderId: string, resolution: ResolutionRequest) {
    const user = await this.hasuraUserService.getUser();
    if (!user.business) {
      throw new HttpException(
        'Only business users can resolve failed deliveries',
        HttpStatus.FORBIDDEN
      );
    }

    // Get failed delivery and order details
    const failedDelivery = await this.getFailedDelivery(orderId);

    if (failedDelivery.status === 'completed') {
      throw new HttpException(
        'This failed delivery has already been resolved',
        HttpStatus.BAD_REQUEST
      );
    }

    const order = failedDelivery.order;

    // Get order hold
    const getOrderHoldQuery = `
      query GetOrderHold($orderId: uuid!) {
        order_holds(where: { order_id: { _eq: $orderId } }) {
          id
          client_hold_amount
          agent_hold_amount
          delivery_fees
          currency
        }
      }
    `;

    const holdResult = await this.hasuraSystemService.executeQuery(
      getOrderHoldQuery,
      { orderId }
    );

    if (!holdResult.order_holds || holdResult.order_holds.length === 0) {
      throw new HttpException('Order hold not found', HttpStatus.NOT_FOUND);
    }

    const orderHold = holdResult.order_holds[0];

    // Process resolution based on type
    switch (resolution.resolution_type) {
      case 'agent_fault':
        await this.resolveAgentFault(order, orderHold);
        break;
      case 'item_fault':
        await this.resolveItemFault(
          order,
          orderHold,
          resolution.restore_inventory ?? true
        );
        break;
      case 'client_fault':
        await this.resolveClientFault(order, orderHold);
        break;
      default:
        throw new HttpException(
          'Invalid resolution type',
          HttpStatus.BAD_REQUEST
        );
    }

    // Update failed delivery status
    const updateMutation = `
      mutation UpdateFailedDelivery($id: uuid!, $updates: failed_deliveries_set_input!) {
        update_failed_deliveries_by_pk(pk_columns: { id: $id }, _set: $updates) {
          id
          status
          resolution_type
          outcome
          resolved_by
          resolved_at
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(updateMutation, {
      id: failedDelivery.id,
      updates: {
        status: 'completed',
        resolution_type: resolution.resolution_type,
        outcome: resolution.outcome,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: 'Failed delivery resolved successfully',
    };
  }

  /**
   * Resolve agent fault: Refund client, release agent hold, deposit agent hold to business
   */
  private async resolveAgentFault(order: any, orderHold: any) {
    // Release client hold
    if (orderHold.client_hold_amount > 0) {
      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: orderHold.client_hold_amount,
        transactionType: 'release',
        memo: `Hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    // Release agent hold
    if (orderHold.agent_hold_amount > 0 && order.assigned_agent) {
      const agentAccount = await this.hasuraSystemService.getAccount(
        order.assigned_agent.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: agentAccount.id,
        amount: orderHold.agent_hold_amount,
        transactionType: 'release',
        memo: `Hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });

      // Deposit agent hold amount to business account
      // Get business user_id from order
      const businessUserId = order.business?.user_id;
      if (businessUserId) {
        const businessUserAccount = await this.hasuraSystemService.getAccount(
          businessUserId,
          order.currency
        );

        await this.accountsService.registerTransaction({
          accountId: businessUserAccount.id,
          amount: orderHold.agent_hold_amount,
          transactionType: 'deposit',
          memo: `Agent hold retained for failed delivery - order ${order.order_number} (agent fault)`,
          referenceId: order.id,
        });
      }
    }

    // Release delivery fees if any
    if (orderHold.delivery_fees > 0) {
      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: orderHold.delivery_fees,
        transactionType: 'release',
        memo: `Delivery fee hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });
    }
  }

  /**
   * Resolve item fault: Refund both client and agent, optionally restore inventory
   */
  private async resolveItemFault(
    order: any,
    orderHold: any,
    restoreInventory: boolean
  ) {
    // Release client hold
    if (orderHold.client_hold_amount > 0) {
      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: orderHold.client_hold_amount,
        transactionType: 'release',
        memo: `Hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    // Release agent hold
    if (orderHold.agent_hold_amount > 0 && order.assigned_agent) {
      const agentAccount = await this.hasuraSystemService.getAccount(
        order.assigned_agent.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: agentAccount.id,
        amount: orderHold.agent_hold_amount,
        transactionType: 'release',
        memo: `Hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    // Release delivery fees if any
    if (orderHold.delivery_fees > 0) {
      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: orderHold.delivery_fees,
        transactionType: 'release',
        memo: `Delivery fee hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    // Restore inventory if requested
    if (restoreInventory && order.order_items) {
      try {
        await this.ordersService.updateReservedQuantities(
          order.order_items,
          'increment'
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to restore inventory for order ${order.order_number}: ${error.message}`
        );
        // Don't fail the resolution if inventory restoration fails
      }
    }
  }

  /**
   * Resolve client fault: Refund both, charge client failed delivery fee (negative balance), split fee 50/50 to agent and business
   */
  private async resolveClientFault(order: any, orderHold: any) {
    // Release client hold
    if (orderHold.client_hold_amount > 0) {
      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: orderHold.client_hold_amount,
        transactionType: 'release',
        memo: `Hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    // Release agent hold
    if (orderHold.agent_hold_amount > 0 && order.assigned_agent) {
      const agentAccount = await this.hasuraSystemService.getAccount(
        order.assigned_agent.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: agentAccount.id,
        amount: orderHold.agent_hold_amount,
        transactionType: 'release',
        memo: `Hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    // Release delivery fees if any
    if (orderHold.delivery_fees > 0) {
      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: clientAccount.id,
        amount: orderHold.delivery_fees,
        transactionType: 'release',
        memo: `Delivery fee hold released for failed delivery - order ${order.order_number}`,
        referenceId: order.id,
      });
    }

    // Get failed delivery fee configuration
    // Use delivery address country or default to GA
    const country = order.delivery_address?.country || 'GA';
    const failedDeliveryFee =
      await this.deliveryConfigService.getDeliveryConfig(
        country,
        'failed_delivery_fees'
      );

    if (failedDeliveryFee === null || typeof failedDeliveryFee !== 'number') {
      throw new HttpException(
        'Failed delivery fee configuration not found',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const failureFee = failedDeliveryFee;
    const splitAmount = failureFee / 2; // 50/50 split

    // Charge client (create negative balance via withdrawal)
    const clientAccount = await this.hasuraSystemService.getAccount(
      order.client.user.id,
      order.currency
    );

    // Use withdrawal to create negative balance
    await this.accountsService.registerTransaction({
      accountId: clientAccount.id,
      amount: failureFee,
      transactionType: 'withdrawal',
      memo: `Failed delivery fee - order ${order.order_number} (client fault)`,
      referenceId: order.id,
    });

    // Deposit 50% to agent account
    if (order.assigned_agent) {
      const agentAccount = await this.hasuraSystemService.getAccount(
        order.assigned_agent.user.id,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: agentAccount.id,
        amount: splitAmount,
        transactionType: 'deposit',
        memo: `Failed delivery fee split - order ${order.order_number} (client fault)`,
        referenceId: order.id,
      });
    }

    // Deposit 50% to business account
    const businessUserId = order.business?.user_id;
    if (businessUserId) {
      const businessUserAccount = await this.hasuraSystemService.getAccount(
        businessUserId,
        order.currency
      );

      await this.accountsService.registerTransaction({
        accountId: businessUserAccount.id,
        amount: splitAmount,
        transactionType: 'deposit',
        memo: `Failed delivery fee split - order ${order.order_number} (client fault)`,
        referenceId: order.id,
      });
    }
  }
}
