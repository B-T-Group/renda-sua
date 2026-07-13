import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { Orders } from '../generated/graphql';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StripeCaptureService } from '../stripe-payments/stripe-capture.service';
import { OrderQueueService } from './order-queue.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

/**
 * Singleton system actions for orders (cron / webhooks).
 * Must not inject request-scoped providers (e.g. HasuraUserService / OrdersService).
 */
@Injectable()
export class OrderSystemJobsService {
  private readonly logger = new Logger(OrderSystemJobsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly stripeCaptureService: StripeCaptureService,
    private readonly orderQueueService: OrderQueueService,
    private readonly waitAndExecuteScheduleService: WaitAndExecuteScheduleService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  /** System-initiated cancel for stale authorized orders (reconciler). */
  async cancelStaleAuthorizedOrderAsSystem(orderId: string): Promise<void> {
    const order = await this.getOrderDetails(orderId);
    if (!this.isStaleAuthorizedCancelCandidate(order)) {
      this.logger.warn(
        `Skipping stale cancel for ${orderId}: preconditions no longer match`
      );
      return;
    }

    const previousStatus = order.current_status;
    await this.releaseStripeAuthorizationIfNeeded(order);
    await this.markOrderCancelledBySystem(orderId);

    await this.runOrderCancellationSideEffects(
      order,
      orderId,
      previousStatus,
      'system',
      'Auto-cancelled: no agent claimed within timeout'
    );
  }

  /** Re-check reconciler preconditions immediately before mutating. */
  private isStaleAuthorizedCancelCandidate(
    order: Orders | null
  ): order is Orders {
    if (!order) return false;
    const fulfillment = (order as any).fulfillment_method as string | null;
    return (
      order.current_status === 'ready_for_pickup' &&
      (order as any).payment_status === 'authorized' &&
      (order as any).payment_source === 'credit_card' &&
      !order.assigned_agent_id &&
      fulfillment !== 'pickup'
    );
  }

  async onOrderPaymentFailed(
    orderId: string,
    failureMessage?: string | null
  ): Promise<void> {
    try {
      const order = await this.getOrderDetails(orderId);
      if (!order) {
        throw new Error(`Order with ID ${orderId} not found`);
      }
      const msg = failureMessage?.trim() || 'Payment failed';
      await this.markPaymentFailed(orderId, msg);
      await this.waitAndExecuteScheduleService.schedulePaymentTimeout(
        'order.payment_failed',
        { order_id: orderId },
        180
      );
      await this.notifyPaymentFailed(order, orderId, msg);
      const userId = order.client?.user_id;
      if (!userId) {
        throw new Error('Client user ID not found in order');
      }
      await this.createStatusHistoryEntry(
        orderId,
        order.current_status,
        'Payment failed',
        'client',
        userId,
        msg
      );
      this.logger.log(
        `Marked order ${order.order_number} payment as failed (status kept: ${order.current_status})`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to handle order payment failure for order ${orderId}: ${
          error?.message ?? String(error)
        }`
      );
      throw error;
    }
  }

  private async markOrderCancelledBySystem(orderId: string): Promise<void> {
    const at = new Date().toISOString();
    await this.hasuraSystemService.executeMutation(
      `
      mutation CancelStaleAuthorizedOrder($orderId: uuid!, $at: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            current_status: cancelled
            cancelled_by: "system"
            cancelled_at: $at
            payment_status: "cancelled"
            updated_at: $at
          }
        ) { id }
      }
    `,
      { orderId, at }
    );
  }

  private async markPaymentFailed(
    orderId: string,
    msg: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation MarkOrderPaymentFailed(
        $orderId: uuid!
        $paymentStatus: String!
        $paymentFailedAt: timestamptz!
        $paymentFailureMessage: String!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            payment_status: $paymentStatus
            payment_failed_at: $paymentFailedAt
            payment_failure_message: $paymentFailureMessage
            updated_at: "now()"
          }
        ) { id payment_status payment_failed_at }
      }
    `,
      {
        orderId,
        paymentStatus: 'failed',
        paymentFailedAt: new Date().toISOString(),
        paymentFailureMessage: msg,
      }
    );
  }

  private async notifyPaymentFailed(
    order: Orders,
    orderId: string,
    msg: string
  ): Promise<void> {
    try {
      const publicWebAppUrl =
        this.configService.get('publicWebAppUrl') || 'https://rendasua.com';
      const orderUrl = `${String(publicWebAppUrl).replace(/\/$/, '')}/orders/${orderId}`;
      const clientUser = order.client?.user;
      await this.notificationsService.sendOrderPaymentFailedPush({
        userId: order.client?.user_id,
        orderId,
        orderNumber: order.order_number,
        failureMessage: msg,
      });
      if (clientUser?.email?.trim()) {
        await this.notificationsService.sendClientOrderPaymentFailedEmail({
          to: clientUser.email.trim(),
          preferredLanguage: clientUser.preferred_language,
          clientName: [clientUser.first_name, clientUser.last_name]
            .filter(Boolean)
            .join(' ')
            .trim(),
          orderNumber: order.order_number,
          orderUrl,
          failureMessage: msg,
        });
      } else if (clientUser?.phone_number?.trim()) {
        await this.notificationsService.sendClientPaymentFailedSms({
          to: clientUser.phone_number.trim(),
          preferredLanguage: clientUser.preferred_language,
          orderNumber: order.order_number,
        });
      }
      await this.notifyAgentIfPayAtDelivery(order, orderId, msg, orderUrl);
    } catch (notifyErr: any) {
      this.logger.error(
        `Failed to send payment-failed notifications for order ${orderId}: ${
          notifyErr?.message ?? String(notifyErr)
        }`
      );
    }
  }

  private async notifyAgentIfPayAtDelivery(
    order: Orders,
    orderId: string,
    msg: string,
    orderUrl: string
  ): Promise<void> {
    const paymentTiming = (order as any).payment_timing as
      | 'pay_now'
      | 'pay_at_delivery'
      | undefined;
    if (paymentTiming !== 'pay_at_delivery') return;
    const assignedAgent = order.assigned_agent;
    await this.notificationsService.sendOrderPaymentFailedPush({
      userId: assignedAgent?.user_id,
      orderId,
      orderNumber: order.order_number,
      failureMessage: msg,
    });
    const agentUser = assignedAgent?.user;
    if (!agentUser?.email) return;
    await this.notificationsService.sendAgentOrderPaymentFailedEmail({
      to: agentUser.email,
      preferredLanguage: agentUser.preferred_language,
      agentName: [agentUser.first_name, agentUser.last_name]
        .filter(Boolean)
        .join(' ')
        .trim(),
      orderNumber: order.order_number,
      orderUrl,
      failureMessage: msg,
    });
  }

  private async runOrderCancellationSideEffects(
    order: Orders,
    orderId: string,
    previousStatus: string,
    cancelledBy: 'client' | 'business' | 'system',
    notes?: string
  ): Promise<void> {
    try {
      await this.decrementReservedQuantities(order.order_items || []);
    } catch (error: any) {
      this.logger.error(
        `Failed to update reserved quantities after cancellation: ${error?.message}`
      );
    }
    try {
      await this.orderQueueService.sendOrderCancelledMessage(
        orderId,
        cancelledBy,
        notes,
        previousStatus
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send order.cancelled message to SQS: ${error?.message}`
      );
    }
  }

  private async releaseStripeAuthorizationIfNeeded(
    order: Orders
  ): Promise<void> {
    if ((order as any).payment_source !== 'credit_card') return;
    const ps = (order as any).payment_status;
    if (ps !== 'authorized' && ps !== 'pending') return;
    const cancelResult = await this.stripeCaptureService.cancelOrderPaymentIntent({
      orderNumber: order.order_number,
      orderId: order.id,
    });
    if (!cancelResult.success && !cancelResult.skipped) {
      this.logger.warn(
        `Stripe authorization cancel failed for order ${order.order_number}: ${cancelResult.message}`
      );
    }
  }

  private async decrementReservedQuantities(orderItems: any[]): Promise<void> {
    const validItems = orderItems.filter(
      (item) => item.business_inventory_id && item.quantity
    );
    if (!validItems.length) return;
    const quantityChanges = new Map<string, number>();
    for (const item of validItems) {
      const id = item.business_inventory_id as string;
      quantityChanges.set(
        id,
        (quantityChanges.get(id) || 0) + Number(item.quantity)
      );
    }
    const ids = [...quantityChanges.keys()];
    const currentData = await this.hasuraSystemService.executeQuery(
      `query GetCurrentReservedQuantities($ids: [uuid!]!) {
        business_inventory(where: { id: { _in: $ids } }) {
          id
          reserved_quantity
        }
      }`,
      { ids }
    );
    const quantityMap = new Map<string, number>();
    for (const inv of currentData.business_inventory || []) {
      quantityMap.set(inv.id, inv.reserved_quantity || 0);
    }
    await Promise.all(
      [...quantityChanges.entries()].map(([id, quantity]) => {
        const next = Math.max(0, (quantityMap.get(id) || 0) - quantity);
        return this.hasuraSystemService.executeMutation(
          `mutation UpdateReservedQuantity($id: uuid!, $reservedQuantity: Int!) {
            update_business_inventory_by_pk(
              pk_columns: { id: $id }
              _set: { reserved_quantity: $reservedQuantity }
            ) { id }
          }`,
          { id, reservedQuantity: next }
        );
      })
    );
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
    await this.hasuraSystemService.executeMutation(
      `
      mutation CreateStatusHistory(
        $orderId: uuid!
        $status: order_status!
        $notes: String!
        $changedByType: String!
        $changedByUserId: uuid!
      ) {
        insert_order_status_history(objects: [{
          order_id: $orderId,
          status: $status,
          notes: $notes,
          changed_by_type: $changedByType,
          changed_by_user_id: $changedByUserId
        }]) { affected_rows }
      }
    `,
      {
        orderId,
        status,
        notes: finalNotes,
        changedByType,
        changedByUserId,
      }
    );
  }

  private async getOrderDetails(orderId: string): Promise<Orders | null> {
    const result = await this.hasuraSystemService.executeQuery(
      `
      query GetOrderForSystemJobs($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          payment_status
          payment_source
          payment_timing
          fulfillment_method
          business_id
          client_id
          client {
            user_id
            user {
              first_name
              last_name
              email
              phone_number
              preferred_language
            }
          }
          assigned_agent_id
          assigned_agent {
            user_id
            user {
              first_name
              last_name
              email
              preferred_language
            }
          }
          order_items {
            id
            business_inventory_id
            quantity
          }
        }
      }
    `,
      { orderId }
    );
    return result.orders_by_pk;
  }
}
