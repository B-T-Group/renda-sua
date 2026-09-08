import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  resolveMarkReadyDelayMinutes,
  type PrepDurationSample,
} from './mark-ready-prep-delay.util';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

type MarkReadyOrderRow = {
  id: string;
  order_number: string;
  current_status: string;
  fulfillment_method?: string | null;
  fulfillment_timing?: string | null;
  business_id: string;
  business_location_id?: string | null;
  client_ready_nudge_sent_at?: string | null;
  client?: { user_id?: string | null } | null;
  business?: {
    user_id?: string | null;
    user?: { preferred_language?: string | null } | null;
  } | null;
};

/**
 * Schedules the delayed merchant "mark as ready" WhatsApp prompt after ASAP
 * confirm, handles the Step Functions callback, and client one-time nudges.
 */
@Injectable()
export class OrderMarkReadyService {
  private readonly logger = new Logger(OrderMarkReadyService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly hasuraUser: HasuraUserService,
    private readonly waitAndExecute: WaitAndExecuteScheduleService,
    private readonly notifications: NotificationsService
  ) {}

  async scheduleAfterConfirm(order: {
    id: string;
    business_id: string;
    fulfillment_method?: string | null;
    fulfillment_timing?: string | null;
    delivery_time_windows?: Array<{ id: string }>;
  }): Promise<void> {
    if (!this.isAsapNonShipping(order)) return;
    try {
      const delayMinutes = await this.resolveDelayMinutes(order.business_id);
      await this.waitAndExecute.scheduleAcceptanceTimeout(
        'order.mark_ready_prompt',
        { order_id: order.id },
        delayMinutes * 60
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to schedule mark-ready prompt for ${order.id}: ${error?.message}`
      );
    }
  }

  /**
   * Delayed WhatsApp `order_mark_ready_business` prompt. Send only after the
   * business has confirmed and before the order is marked ready.
   */
  async onMarkReadyPrompt(orderId: string): Promise<{
    success: boolean;
    skipped?: boolean;
    reason?: string;
  }> {
    const order = await this.loadOrder(orderId);
    if (!order) return { success: false, reason: 'order_not_found' };
    const skipReason = this.skipMarkReadyPromptReason(order.current_status);
    if (skipReason) return { success: true, skipped: true, reason: skipReason };
    await this.sendMarkReadyPrompt(order);
    return { success: true };
  }

  async remindReady(orderId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const user = await this.hasuraUser.getUser();
    const order = await this.loadOrder(orderId);
    if (!order) throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    this.assertClientOwnsOrder(order, user.id);
    this.assertRemindable(order);
    const stamped = await this.stampNudgeSent(orderId);
    if (!stamped) {
      throw new HttpException(
        'You already asked if this order is ready',
        HttpStatus.CONFLICT
      );
    }
    await this.notifications.sendClientReadyNudgeToBusiness({
      orderId: order.id,
      orderNumber: order.order_number,
      businessUserId: order.business?.user_id,
      businessLocationId: order.business_location_id,
      preferredLanguage: order.business?.user?.preferred_language,
    });
    return {
      success: true,
      message: 'Reminder sent to the business',
    };
  }

  private skipMarkReadyPromptReason(status: string): string | null {
    if (status === 'confirmed' || status === 'preparing') return null;
    return status === 'pending' ? 'not_confirmed' : 'not_actionable';
  }

  private async sendMarkReadyPrompt(order: MarkReadyOrderRow): Promise<void> {
    await this.notifications.sendMarkReadyPromptNotifications({
      orderId: order.id,
      orderNumber: order.order_number,
      businessUserId: order.business?.user_id,
      businessLocationId: order.business_location_id,
      preferredLanguage: order.business?.user?.preferred_language,
    });
  }

  private isAsapNonShipping(order: {
    fulfillment_method?: string | null;
    fulfillment_timing?: string | null;
    delivery_time_windows?: Array<{ id: string }>;
  }): boolean {
    if (order.fulfillment_method === 'shipping') return false;
    if (order.fulfillment_timing === 'asap') return true;
    const windows = order.delivery_time_windows?.length ?? 0;
    return windows === 0 && order.fulfillment_timing !== 'scheduled';
  }

  private async resolveDelayMinutes(businessId: string): Promise<number> {
    const completedCount = await this.countCompletedOrders(businessId);
    const samples =
      completedCount >= 5 ? await this.loadPrepSamples(businessId) : [];
    return resolveMarkReadyDelayMinutes({
      completedOrderCount: completedCount,
      prepSamples: samples,
    });
  }

  private async countCompletedOrders(businessId: string): Promise<number> {
    const res = await this.hasura.executeQuery<{
      orders_aggregate: { aggregate?: { count?: number | null } | null };
    }>(
      `query CompletedCount($bid: uuid!) {
        orders_aggregate(
          where: {
            business_id: { _eq: $bid }
            current_status: { _in: [complete, delivered] }
          }
        ) { aggregate { count } }
      }`,
      { bid: businessId }
    );
    return res.orders_aggregate?.aggregate?.count ?? 0;
  }

  private async loadPrepSamples(
    businessId: string
  ): Promise<PrepDurationSample[]> {
    const res = await this.hasura.executeQuery<{
      orders: PrepDurationSample[];
    }>(
      `query PrepSamples($bid: uuid!) {
        orders(
          where: {
            business_id: { _eq: $bid }
            current_status: { _in: [complete, delivered] }
          }
          order_by: { completed_at: desc }
          limit: 50
        ) {
          accepted_at
          order_status_history(
            where: { status: { _in: [confirmed, preparing, ready_for_pickup] } }
            order_by: { created_at: asc }
          ) { status created_at }
        }
      }`,
      { bid: businessId }
    );
    return res.orders ?? [];
  }

  private async loadOrder(orderId: string): Promise<MarkReadyOrderRow | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: MarkReadyOrderRow | null;
    }>(
      `query MarkReadyOrder($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status fulfillment_method fulfillment_timing
          business_id business_location_id client_ready_nudge_sent_at
          client { user_id }
          business { user_id user { preferred_language } }
        }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk ?? null;
  }

  private assertClientOwnsOrder(order: MarkReadyOrderRow, userId: string): void {
    if (order.client?.user_id !== userId) {
      throw new HttpException(
        'Unauthorized to remind for this order',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private assertRemindable(order: MarkReadyOrderRow): void {
    if (order.fulfillment_method === 'shipping') {
      throw new HttpException(
        'Cannot remind for shipping orders',
        HttpStatus.BAD_REQUEST
      );
    }
    if (order.current_status !== 'confirmed') {
      throw new HttpException(
        'Order must be confirmed to ask if it is ready',
        HttpStatus.BAD_REQUEST
      );
    }
    if (order.client_ready_nudge_sent_at) {
      throw new HttpException(
        'You already asked if this order is ready',
        HttpStatus.CONFLICT
      );
    }
  }

  private async stampNudgeSent(orderId: string): Promise<boolean> {
    const res = await this.hasura.executeMutation<{
      update_orders?: { affected_rows?: number };
    }>(
      `mutation StampReadyNudge($id: uuid!, $at: timestamptz!) {
        update_orders(
          where: {
            id: { _eq: $id }
            current_status: { _eq: confirmed }
            client_ready_nudge_sent_at: { _is_null: true }
          }
          _set: { client_ready_nudge_sent_at: $at }
        ) { affected_rows }
      }`,
      { id: orderId, at: new Date().toISOString() }
    );
    return (res.update_orders?.affected_rows ?? 0) > 0;
  }
}
