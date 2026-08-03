import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StripeCaptureService } from '../stripe-payments/stripe-capture.service';
import { StripeRefundService } from '../stripe-payments/stripe-refund.service';
import {
  isOrderWindowStale,
  resolveCleanupTimezone,
  type CleanupWindowOrder,
} from './order-cleanup-window.util';
import {
  CANCEL_REASON_NOT_PICKED_UP_IN_TIME,
  CANCEL_REASON_PAYMENT_NOT_COMPLETED,
  FAILURE_REASON_DELIVERY_WINDOW_MISSED,
  MID_FULFILLMENT_STATUSES,
  PAYMENT_FAILED_GRACE_MINUTES,
} from './order-cleanup.constants';
import { OrderQueueService } from './order-queue.service';

interface CleanupOrderRow extends CleanupWindowOrder {
  id: string;
  order_number: string;
  current_status: string;
  payment_status?: string | null;
  payment_source?: string | null;
  created_at?: string;
  client?: {
    user_id?: string;
    user?: {
      timezone?: string | null;
      preferred_language?: string | null;
    } | null;
  } | null;
  business?: {
    user_id?: string;
    user?: { preferred_language?: string | null } | null;
  } | null;
  assigned_agent_id?: string | null;
  order_items?: Array<{
    id: string;
    business_inventory_id?: string | null;
    quantity?: number;
  }>;
  /** Hasura array relationship on orders (singular name). */
  failed_delivery?: Array<{ id: string }>;
}

interface DigestParty {
  userId: string;
  preferredLanguage?: string | null;
  persona: 'client' | 'business';
  orderNumbers: string[];
}

/**
 * Daily stale-order cleanup (singleton; safe for cron).
 * Must not inject request-scoped providers.
 */
@Injectable()
export class OrderCleanupService {
  private readonly logger = new Logger(OrderCleanupService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly stripeCaptureService: StripeCaptureService,
    private readonly stripeRefundService: StripeRefundService,
    private readonly orderQueueService: OrderQueueService,
    private readonly notificationsService: NotificationsService,
    private readonly deliveryConfigService: DeliveryConfigService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  async runDailyCleanup(): Promise<void> {
    const cfg = this.configService.get<Configuration['order']>('order');
    if (cfg?.cleanupEnabled === false) {
      this.logger.debug('Order cleanup disabled; skipping');
      return;
    }
    const grace = cfg?.cleanupGraceHours ?? 24;
    const limit = cfg?.cleanupBatchLimit ?? 100;
    const pending = await this.cancelStalePendingPaymentOrders(grace, limit);
    const missed = await this.cancelMissedPickupOrders(grace, limit);
    const failed = await this.failMissedDeliveryOrders(grace, limit);
    this.logger.log(
      `Order cleanup: pending_payment=${pending}, ready_for_pickup=${missed}, mid_fulfillment_failed=${failed}`
    );
  }

  /**
   * Cancel pending_payment untouched longer than grace; one digest per party.
   * Uses updated_at so payment retries reset the clock.
   */
  async cancelStalePendingPaymentOrders(
    graceHours: number,
    limit: number
  ): Promise<number> {
    const cutoff = new Date(
      Date.now() - graceHours * 60 * 60 * 1000
    ).toISOString();
    const orders = await this.queryPendingPaymentOrders(cutoff, limit);
    const digests = new Map<string, DigestParty>();
    let count = 0;
    for (const order of orders) {
      const ok = await this.cancelPendingPaymentOrder(order);
      if (!ok) continue;
      count += 1;
      this.collectDigest(digests, order);
    }
    await this.sendDigests([...digests.values()]);
    return count;
  }

  /** Cancel ready_for_pickup when pickup/delivery window + grace has passed. */
  async cancelMissedPickupOrders(
    graceHours: number,
    limit: number
  ): Promise<number> {
    return this.processWindowOrders(
      ['ready_for_pickup'],
      graceHours,
      limit,
      async (order) => {
        if (!(await this.isStaleWindowOrder(order, graceHours))) return false;
        return this.cancelMissedPickupOrder(order);
      }
    );
  }

  /** Fail mid-fulfillment orders past window + grace; create failed_deliveries. */
  async failMissedDeliveryOrders(
    graceHours: number,
    limit: number
  ): Promise<number> {
    const reasonId = await this.getDeliveryWindowMissedReasonId();
    if (!reasonId) {
      this.logger.error(
        `Missing delivery_failure_reasons.${FAILURE_REASON_DELIVERY_WINDOW_MISSED}`
      );
      return 0;
    }
    return this.processWindowOrders(
      [...MID_FULFILLMENT_STATUSES],
      graceHours,
      limit,
      async (order) => {
        if (order.failed_delivery?.length) return false;
        if (!(await this.isStaleWindowOrder(order, graceHours))) return false;
        return this.failMissedDeliveryOrder(order, reasonId);
      }
    );
  }

  /** Paginate window candidates so non-stale rows cannot starve the batch. */
  private async processWindowOrders(
    statuses: string[],
    graceHours: number,
    limit: number,
    handle: (order: CleanupOrderRow) => Promise<boolean>
  ): Promise<number> {
    const pageSize = Math.max(limit, 50);
    let count = 0;
    let offset = 0;
    for (let page = 0; page < 20 && count < limit; page += 1) {
      const orders = await this.queryWindowOrders(
        statuses,
        graceHours,
        pageSize,
        offset
      );
      if (!orders.length) break;
      for (const order of orders) {
        if (count >= limit) break;
        if (await handle(order)) count += 1;
      }
      offset += orders.length;
      if (orders.length < pageSize) break;
    }
    return count;
  }

  private async cancelPendingPaymentOrder(
    order: CleanupOrderRow
  ): Promise<boolean> {
    const fresh = await this.getOrderStatus(order.id);
    if (fresh !== 'pending_payment') return false;
    const previousStatus = fresh;
    const paymentStatus = await this.releaseOrRefundStripe(order);
    await this.markCancelled(
      order.id,
      CANCEL_REASON_PAYMENT_NOT_COMPLETED,
      'Payment not completed in time',
      paymentStatus
    );
    await this.insertSystemHistory(
      order.id,
      'cancelled',
      'Auto-cancelled: payment not completed in time'
    );
    await this.runCancelSideEffects(
      order,
      previousStatus,
      'Auto-cancelled: payment not completed in time',
      false
    );
    return true;
  }

  private async cancelMissedPickupOrder(
    order: CleanupOrderRow
  ): Promise<boolean> {
    const fresh = await this.getOrderStatus(order.id);
    if (fresh !== 'ready_for_pickup') return false;
    const previousStatus = fresh;
    const paymentStatus = await this.releaseOrRefundStripe(order);
    await this.markCancelled(
      order.id,
      CANCEL_REASON_NOT_PICKED_UP_IN_TIME,
      'Order was not picked up in time',
      paymentStatus
    );
    await this.insertSystemHistory(
      order.id,
      'cancelled',
      'Auto-cancelled: not picked up before window elapsed'
    );
    await this.runCancelSideEffects(
      order,
      previousStatus,
      'Auto-cancelled: not picked up before window elapsed',
      true
    );
    return true;
  }

  private async failMissedDeliveryOrder(
    order: CleanupOrderRow,
    reasonId: string
  ): Promise<boolean> {
    const fresh = await this.getOrderStatus(order.id);
    if (!fresh || !MID_FULFILLMENT_STATUSES.includes(fresh as any)) {
      return false;
    }
    await this.markFailedWithDeliveryRecord(order.id, reasonId);
    await this.insertSystemHistory(
      order.id,
      'failed',
      'Auto-failed: delivery window missed'
    );
    try {
      await this.orderQueueService.sendOrderStatusUpdatedMessage(
        order.id,
        fresh,
        'failed',
        null
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to queue status.updated for ${order.id}: ${error?.message}`
      );
    }
    return true;
  }

  private async isStaleWindowOrder(
    order: CleanupOrderRow,
    graceHours: number
  ): Promise<boolean> {
    const country =
      order.business_location?.address?.country ||
      order.delivery_address?.country ||
      'GA';
    const configTz = await this.deliveryConfigService.getTimezone(country);
    const tz = resolveCleanupTimezone(order, configTz);
    return isOrderWindowStale(order, graceHours, tz);
  }

  private collectDigest(
    digests: Map<string, DigestParty>,
    order: CleanupOrderRow
  ): void {
    const clientId = order.client?.user_id?.trim();
    if (clientId) {
      this.addDigest(
        digests,
        `client:${clientId}`,
        clientId,
        order.client?.user?.preferred_language,
        'client',
        order.order_number
      );
    }
    const businessId = order.business?.user_id?.trim();
    if (businessId) {
      this.addDigest(
        digests,
        `business:${businessId}`,
        businessId,
        order.business?.user?.preferred_language,
        'business',
        order.order_number
      );
    }
  }

  private addDigest(
    digests: Map<string, DigestParty>,
    key: string,
    userId: string,
    preferredLanguage: string | null | undefined,
    persona: 'client' | 'business',
    orderNumber: string
  ): void {
    const existing = digests.get(key);
    if (existing) {
      existing.orderNumbers.push(orderNumber);
      return;
    }
    digests.set(key, {
      userId,
      preferredLanguage,
      persona,
      orderNumbers: [orderNumber],
    });
  }

  private async sendDigests(parties: DigestParty[]): Promise<void> {
    for (const party of parties) {
      await this.notificationsService.sendPendingPaymentCleanupDigestPush({
        userId: party.userId,
        orderNumbers: party.orderNumbers,
        preferredLanguage: party.preferredLanguage,
        persona: party.persona,
      });
    }
  }

  private async queryPendingPaymentOrders(
    cutoff: string,
    limit: number
  ): Promise<CleanupOrderRow[]> {
    const paymentFailedCutoff = new Date(
      Date.now() - PAYMENT_FAILED_GRACE_MINUTES * 60 * 1000
    ).toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      orders: CleanupOrderRow[];
    }>(
      `
      query StalePendingPaymentOrders(
        $cutoff: timestamptz!
        $paymentFailedCutoff: timestamptz!
        $limit: Int!
      ) {
        orders(
          where: {
            current_status: { _eq: "pending_payment" }
            updated_at: { _lt: $cutoff }
            _or: [
              { payment_failed_at: { _is_null: true } }
              { payment_failed_at: { _lt: $paymentFailedCutoff } }
            ]
          }
          order_by: { updated_at: asc }
          limit: $limit
        ) {
          id
          order_number
          current_status
          payment_status
          payment_source
          created_at
          updated_at
          client { user_id user { preferred_language timezone } }
          business { user_id user { preferred_language } }
          order_items { id business_inventory_id quantity }
        }
      }
    `,
      { cutoff, paymentFailedCutoff, limit }
    );
    return res.orders ?? [];
  }

  private async queryWindowOrders(
    statuses: string[],
    graceHours: number,
    limit: number,
    offset = 0
  ): Promise<CleanupOrderRow[]> {
    // Coarse filter: any past calendar date or pickup_by past grace; precise check in Node.
    const todayUtc = new Date().toISOString().slice(0, 10);
    const pickupCutoff = new Date(
      Date.now() - graceHours * 60 * 60 * 1000
    ).toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      orders: CleanupOrderRow[];
    }>(
      `
      query StaleWindowOrders(
        $statuses: [order_status!]!
        $todayUtc: date!
        $pickupCutoff: timestamptz!
        $limit: Int!
        $offset: Int!
      ) {
        orders(
          where: {
            current_status: { _in: $statuses }
            _or: [
              { pickup_by: { _lt: $pickupCutoff } }
              {
                delivery_time_window: {
                  preferred_date: { _lt: $todayUtc }
                }
              }
            ]
          }
          order_by: [{ pickup_by: asc_nulls_last }, { updated_at: asc }]
          limit: $limit
          offset: $offset
        ) {
          id
          order_number
          current_status
          payment_status
          payment_source
          pickup_by
          assigned_agent_id
          client { user_id user { preferred_language timezone } }
          business { user_id user { preferred_language } }
          delivery_address { country }
          business_location { address { country } }
          delivery_time_window {
            preferred_date
            time_slot_end
          }
          order_items { id business_inventory_id quantity }
          failed_delivery(limit: 1) { id }
        }
      }
    `,
      { statuses, todayUtc, pickupCutoff, limit, offset }
    );
    return res.orders ?? [];
  }

  private async getOrderStatus(orderId: string): Promise<string | null> {
    const res = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: { current_status: string } | null;
    }>(
      `query($orderId: uuid!) {
        orders_by_pk(id: $orderId) { current_status }
      }`,
      { orderId }
    );
    return res.orders_by_pk?.current_status ?? null;
  }

  private async markCancelled(
    orderId: string,
    reasonId: number,
    notes: string,
    paymentStatus: 'cancelled' | 'refunded' | 'paid'
  ): Promise<void> {
    const at = new Date().toISOString();
    await this.hasuraSystemService.executeMutation(
      `
      mutation CleanupCancelOrder(
        $orderId: uuid!
        $at: timestamptz!
        $reasonId: Int!
        $notes: String!
        $paymentStatus: String!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            current_status: cancelled
            cancelled_by: "system"
            cancelled_at: $at
            cancellation_reason_id: $reasonId
            cancellation_notes: $notes
            payment_status: $paymentStatus
            updated_at: $at
          }
        ) { id }
      }
    `,
      { orderId, at, reasonId, notes, paymentStatus }
    );
  }

  /** Single Hasura mutation so status + failed_deliveries stay consistent. */
  private async markFailedWithDeliveryRecord(
    orderId: string,
    reasonId: string
  ): Promise<void> {
    const at = new Date().toISOString();
    await this.hasuraSystemService.executeMutation(
      `
      mutation CleanupFailOrderWithRecord(
        $orderId: uuid!
        $at: timestamptz!
        $reasonId: uuid!
        $notes: String!
      ) {
        insert_failed_deliveries_one(object: {
          order_id: $orderId
          failure_reason_id: $reasonId
          notes: $notes
          status: pending
        }) { id }
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { current_status: failed, updated_at: $at }
        ) { id }
      }
    `,
      {
        orderId,
        at,
        reasonId,
        notes: 'System: delivery window missed / order stuck past slot',
      }
    );
  }

  private async getDeliveryWindowMissedReasonId(): Promise<string | null> {
    const res = await this.hasuraSystemService.executeQuery<{
      delivery_failure_reasons: Array<{ id: string }>;
    }>(
      `
      query DeliveryWindowMissedReason($key: String!) {
        delivery_failure_reasons(
          where: { reason_key: { _eq: $key } }
          limit: 1
        ) { id }
      }
    `,
      { key: FAILURE_REASON_DELIVERY_WINDOW_MISSED }
    );
    return res.delivery_failure_reasons?.[0]?.id ?? null;
  }

  private async insertSystemHistory(
    orderId: string,
    status: string,
    notes: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation CleanupStatusHistory(
        $orderId: uuid!
        $status: order_status!
        $notes: String!
      ) {
        insert_order_status_history(objects: [{
          order_id: $orderId
          status: $status
          notes: $notes
          changed_by_type: "system"
        }]) { affected_rows }
      }
    `,
      { orderId, status, notes }
    );
  }

  private async releaseOrRefundStripe(
    order: CleanupOrderRow
  ): Promise<'cancelled' | 'refunded' | 'paid'> {
    if (order.payment_source !== 'credit_card') return 'cancelled';
    const ps = order.payment_status;
    if (ps === 'authorized' || ps === 'pending') {
      await this.cancelStripeAuth(order);
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
        await this.cancelStripeAuth(order);
        return 'paid';
      }
      if (
        refund.message?.toLowerCase().includes('authorization released') ||
        refund.message?.toLowerCase().includes('already released')
      ) {
        return 'cancelled';
      }
      return 'refunded';
    }
    await this.cancelStripeAuth(order);
    return 'cancelled';
  }

  private async cancelStripeAuth(order: CleanupOrderRow): Promise<void> {
    if (order.payment_source !== 'credit_card') return;
    const ps = order.payment_status;
    if (ps !== 'authorized' && ps !== 'pending') return;
    const result = await this.stripeCaptureService.cancelOrderPaymentIntent({
      orderNumber: order.order_number,
      orderId: order.id,
    });
    if (!result.success && !result.skipped) {
      this.logger.warn(
        `Stripe auth cancel failed for ${order.order_number}: ${result.message}`
      );
    }
  }

  private async runCancelSideEffects(
    order: CleanupOrderRow,
    previousStatus: string,
    notes: string,
    notifyViaStatusUpdated: boolean
  ): Promise<void> {
    await this.decrementReservedQuantities(order.order_items || []);
    try {
      await this.orderQueueService.sendOrderCancelledMessage(
        order.id,
        'system',
        notes,
        previousStatus
      );
    } catch (error: any) {
      this.logger.error(
        `order.cancelled SQS failed for ${order.id}: ${error?.message}`
      );
    }
    if (!notifyViaStatusUpdated) return;
    try {
      await this.orderQueueService.sendOrderStatusUpdatedMessage(
        order.id,
        previousStatus,
        'cancelled',
        null
      );
    } catch (error: any) {
      this.logger.error(
        `order.status.updated SQS failed for ${order.id}: ${error?.message}`
      );
    }
  }

  private async decrementReservedQuantities(
    orderItems: CleanupOrderRow['order_items']
  ): Promise<void> {
    const valid = (orderItems || []).filter(
      (item) => item.business_inventory_id && item.quantity
    );
    if (!valid.length) return;
    const quantityChanges = new Map<string, number>();
    for (const item of valid) {
      const id = item.business_inventory_id as string;
      quantityChanges.set(
        id,
        (quantityChanges.get(id) || 0) + Number(item.quantity)
      );
    }
    const ids = [...quantityChanges.keys()];
    const currentData = await this.hasuraSystemService.executeQuery(
      `query($ids: [uuid!]!) {
        business_inventory(where: { id: { _in: $ids } }) {
          id reserved_quantity
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
          `mutation($id: uuid!, $reservedQuantity: Int!) {
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
}
