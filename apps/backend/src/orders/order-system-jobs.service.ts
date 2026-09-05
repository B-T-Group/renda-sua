import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { Orders } from '../generated/graphql';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StripeCaptureService } from '../stripe-payments/stripe-capture.service';
import { StripeRefundService } from '../stripe-payments/stripe-refund.service';
import { OrderCleanupService } from './order-cleanup.service';
import { CANCEL_REASON_NOT_PICKED_UP_IN_TIME } from './order-cleanup.constants';
import { OrderQueueService } from './order-queue.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';
import { releaseReservedInventory } from './release-reserved-inventory.util';

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
    private readonly stripeRefundService: StripeRefundService,
    private readonly orderQueueService: OrderQueueService,
    private readonly waitAndExecuteScheduleService: WaitAndExecuteScheduleService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly orderCleanupService: OrderCleanupService
  ) {}

  /** Daily cleanup: unpaid pending_payment past grace. */
  cancelStalePendingPaymentOrders(
    graceHours: number,
    limit: number
  ): Promise<number> {
    return this.orderCleanupService.cancelStalePendingPaymentOrders(
      graceHours,
      limit
    );
  }

  /** Daily cleanup: ready_for_pickup past delivery/pickup window. */
  cancelMissedPickupOrders(
    graceHours: number,
    limit: number
  ): Promise<number> {
    return this.orderCleanupService.cancelMissedPickupOrders(
      graceHours,
      limit
    );
  }

  /** Daily cleanup: mid-fulfillment past window → failed + failed_deliveries. */
  failMissedDeliveryOrders(
    graceHours: number,
    limit: number
  ): Promise<number> {
    return this.orderCleanupService.failMissedDeliveryOrders(
      graceHours,
      limit
    );
  }

  /**
   * Auto-decline: merchant never accepted within accept + grace window.
   * Claims the cancel with a pending-only CAS before any Stripe release so a
   * concurrent merchant confirm cannot lose its authorization.
   * @returns true when the order was cancelled; false when preconditions no longer match.
   */
  async autoDeclineUnacceptedOrderAsSystem(orderId: string): Promise<boolean> {
    const order = await this.getOrderDetails(orderId);
    if (!order || order.current_status !== 'pending') {
      this.logger.warn(
        `Skipping auto-decline for ${orderId}: not pending`
      );
      return false;
    }

    const previousStatus = order.current_status;
    const claimed = await this.claimAutoDecline(orderId);
    if (!claimed) {
      this.logger.warn(
        `Skipping auto-decline for ${orderId}: lost pending claim race`
      );
      return false;
    }

    try {
      return await this.finalizeAutoDeclinedOrder(order, orderId, previousStatus);
    } catch (error) {
      if (!(error as { paymentFinalized?: boolean }).paymentFinalized) {
        await this.revertSystemCancelClaim(orderId, previousStatus);
      }
      throw error;
    }
  }

  private async finalizeAutoDeclinedOrder(
    order: Orders,
    orderId: string,
    previousStatus: string
  ): Promise<boolean> {
    let paymentFinalized = false;
    let paymentStatus: 'cancelled' | 'refunded' | 'paid' | null = null;
    try {
      paymentStatus = await this.releaseOrRefundStripeIfNeeded(order);
      paymentFinalized = true;
      await this.patchAutoDeclinePaymentStatus(orderId, paymentStatus);
      await this.decrementReservedQuantities(order.order_items || []);
      await this.orderQueueService.sendOrderCancelledMessage(
        orderId,
        'system',
        'Auto-declined: merchant did not accept within the acceptance window',
        previousStatus
      );
      try {
        await this.notifyClientMerchantUnavailable(order, orderId);
      } catch (error: any) {
        this.logger.error(
          `Auto-decline client notify failed for ${orderId}: ${error?.message}`
        );
      }
    } catch (error) {
      if (paymentFinalized) {
        this.logger.error(
          `Post-payment auto-decline finalization failed for ${orderId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        await this.recoverAutoDeclinePostPayment(
          order,
          orderId,
          previousStatus,
          paymentStatus
        );
        return false;
      }
      (error as { paymentFinalized?: boolean }).paymentFinalized =
        paymentFinalized;
      throw error;
    }
    return true;
  }

  private async recoverAutoDeclinePostPayment(
    order: Orders,
    orderId: string,
    previousStatus: string,
    paymentStatus: 'cancelled' | 'refunded' | 'paid' | null
  ): Promise<void> {
    if (paymentStatus) {
      await this.patchAutoDeclinePaymentStatus(orderId, paymentStatus).catch(
        (error: any) =>
          this.logger.error(
            `Auto-decline payment status retry failed for ${orderId}: ${error?.message}`
          )
      );
    }
    await this.decrementReservedQuantities(order.order_items || []).catch(
      (error: any) =>
        this.logger.error(
          `Auto-decline inventory retry failed for ${orderId}: ${error?.message}`
        )
    );
    await this.orderQueueService
      .sendOrderCancelledMessage(
        orderId,
        'system',
        'Auto-declined: merchant did not accept within the acceptance window',
        previousStatus
      )
      .catch((error: any) =>
        this.logger.error(
          `Auto-decline cancellation enqueue retry failed for ${orderId}: ${error?.message}`
        )
      );
  }

  private async revertSystemCancelClaim(
    orderId: string,
    previousStatus: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation RevertSystemCancelClaim($orderId: uuid!, $previousStatus: order_status!) {
        update_orders(
          where: { id: { _eq: $orderId }, current_status: { _eq: cancelled } }
          _set: {
            current_status: $previousStatus
            cancelled_by: null
            cancelled_at: null
            cancellation_reason_id: null
            cancellation_notes: null
            updated_at: "now()"
          }
        ) { affected_rows }
      }`,
      { orderId, previousStatus }
    );
  }

  /** CAS: cancel only while still pending so confirm cannot be overwritten. */
  private async claimAutoDecline(orderId: string): Promise<boolean> {
    const at = new Date().toISOString();
    const result = await this.hasuraSystemService.executeMutation(
      `
      mutation ClaimAutoDecline($orderId: uuid!, $at: timestamptz!) {
        update_orders(
          where: {
            _and: [
              { id: { _eq: $orderId } }
              { current_status: { _eq: pending } }
            ]
          }
          _set: {
            current_status: cancelled
            cancelled_by: "system"
            cancelled_at: $at
            cancellation_reason_id: 19
            cancellation_notes: "The merchant was unavailable to accept your order."
            updated_at: $at
          }
        ) { affected_rows }
      }
    `,
      { orderId, at }
    );
    return (result?.update_orders?.affected_rows ?? 0) === 1;
  }

  private async patchAutoDeclinePaymentStatus(
    orderId: string,
    paymentStatus: 'cancelled' | 'refunded' | 'paid'
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation PatchAutoDeclinePayment(
        $orderId: uuid!
        $paymentStatus: String!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { payment_status: $paymentStatus, updated_at: "now()" }
        ) { id }
      }
    `,
      { orderId, paymentStatus }
    );
  }

  /** Release auth, or full-refund captured card charges. */
  private async releaseOrRefundStripeIfNeeded(
    order: Orders
  ): Promise<'cancelled' | 'refunded' | 'paid'> {
    if ((order as any).payment_source !== 'credit_card') {
      return 'cancelled';
    }
    const ps = (order as any).payment_status as string | null;
    // Manual-capture holds and any pending auth: always cancel the PaymentIntent.
    if (ps === 'authorized' || ps === 'pending') {
      await this.releaseStripeAuthorizationIfNeeded(order);
      return 'cancelled';
    }
    if (ps === 'paid') {
      const refund = await this.stripeRefundService.initiateOrderRefund({
        orderId: order.id,
        orderNumber: order.order_number,
        cancellationFee: 0,
        cancelledBy: 'system',
      });
      if (!refund.success) {
        this.logger.warn(
          `Stripe refund failed for auto-declined order ${order.order_number}: ${refund.message}`
        );
        // Auth may still be open despite paid status drift — try cancel as fallback.
        const cancel = await this.stripeCaptureService.cancelOrderPaymentIntent({
          orderNumber: order.order_number,
          orderId: order.id,
        });
        if (cancel.success && !cancel.skipped) {
          return 'cancelled';
        }
        // Keep paid so order.cancelled Lambda can retry the refund.
        return 'paid';
      }
      // Refund service also cancels uncaptured PIs and returns this message.
      if (
        refund.message?.toLowerCase().includes('authorization released') ||
        refund.message?.toLowerCase().includes('already released')
      ) {
        return 'cancelled';
      }
      return 'refunded';
    }
    // Unknown card status: still attempt auth cancel (no-op if already captured).
    await this.releaseStripeAuthorizationIfNeeded(order);
    return 'cancelled';
  }

  private async notifyClientMerchantUnavailable(
    order: Orders,
    orderId: string
  ): Promise<void> {
    const msg =
      'The merchant was unavailable to accept your order.';
    await this.notificationsService.sendOrderAutoDeclinedPush({
      clientUserId: order.client?.user_id,
      orderId,
      orderNumber: order.order_number,
      preferredLanguage: order.client?.user?.preferred_language,
      failureMessage: msg,
    });
  }

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
    const claimed = await this.claimStaleAuthorizedCancel(orderId);
    if (!claimed) {
      this.logger.warn(
        `Skipping stale cancel for ${orderId}: lost unassigned claim race`
      );
      return;
    }

    let paymentFinalized = false;
    try {
      await this.releaseStripeAuthorizationIfNeeded(order);
      paymentFinalized = true;
      await this.patchAutoDeclinePaymentStatus(orderId, 'cancelled');
      await this.runOrderCancellationSideEffects(
        order,
        orderId,
        previousStatus,
        'system',
        'Auto-cancelled: no agent claimed within timeout'
      );
    } catch (error) {
      if (!paymentFinalized) {
        await this.revertSystemCancelClaim(orderId, previousStatus);
        throw error;
      }
      this.logger.error(
        `Post-payment stale cancel finalization failed for ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await this.recoverStaleAuthorizedPostPayment(
        order,
        orderId,
        previousStatus
      );
    }
  }

  private async recoverStaleAuthorizedPostPayment(
    order: Orders,
    orderId: string,
    previousStatus: string
  ): Promise<void> {
    await this.patchAutoDeclinePaymentStatus(orderId, 'cancelled').catch(
      (error: any) =>
        this.logger.error(
          `Stale cancel payment status retry failed for ${orderId}: ${error?.message}`
        )
    );
    await this.runOrderCancellationSideEffects(
      order,
      orderId,
      previousStatus,
      'system',
      'Auto-cancelled: no agent claimed within timeout'
    ).catch((error: any) =>
      this.logger.error(
        `Stale cancel side-effect retry failed for ${orderId}: ${error?.message}`
      )
    );
  }

  /** CAS: cancel only while still unassigned ready_for_pickup. */
  private async claimStaleAuthorizedCancel(orderId: string): Promise<boolean> {
    const at = new Date().toISOString();
    const result = await this.hasuraSystemService.executeMutation(
      `
      mutation ClaimStaleAuthorizedCancel($orderId: uuid!, $at: timestamptz!, $reasonId: Int!) {
        update_orders(
          where: {
            _and: [
              { id: { _eq: $orderId } }
              { current_status: { _eq: ready_for_pickup } }
              { assigned_agent_id: { _is_null: true } }
              { payment_status: { _eq: "authorized" } }
            ]
          }
          _set: {
            current_status: cancelled
            cancelled_by: "system"
            cancelled_at: $at
            cancellation_reason_id: $reasonId
            cancellation_notes: "No delivery agent claimed the order within the timeout period"
            updated_at: $at
          }
        ) { affected_rows }
      }
    `,
      { orderId, at, reasonId: CANCEL_REASON_NOT_PICKED_UP_IN_TIME }
    );
    return (result?.update_orders?.affected_rows ?? 0) === 1;
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
      throw new Error(
        cancelResult.message || 'Stripe authorization cancel failed'
      );
    }
  }

  private async decrementReservedQuantities(orderItems: any[]): Promise<void> {
    const result = await releaseReservedInventory(
      this.hasuraSystemService,
      orderItems
    );
    if (result.skipped > 0) {
      this.logger.warn(
        `Atomic inventory release skipped ${result.skipped} row(s)`
      );
    }
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
