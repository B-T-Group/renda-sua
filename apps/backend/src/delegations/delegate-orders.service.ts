import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MessagingService } from '../messaging/messaging.service';
import { DeliveryPinShareService } from '../messaging/structured/delivery-pin-share.service';
import { QuickMessageService } from '../messaging/structured/quick-message.service';
import type { AuthorizedBusinessActor } from '../orders/authorized-business-actor';
import { FailedDeliveriesService } from '../orders/failed-deliveries.service';
import type { ResolutionRequest } from '../orders/failed-deliveries.service';
import { OrderStatusService } from '../orders/order-status.service';
import type {
  BatchOrderStatusChangeRequest,
  ConfirmOrderRequest,
  OrderStatusChangeRequest,
} from '../orders/orders.service';
import { OrdersService } from '../orders/orders.service';
import { OrderAcceptanceService } from '../orders/order-acceptance.service';
import { GET_ORDERS } from '../orders/orders.queries';
import type { DelegationAccessContext } from './delegation.types';

@Injectable()
export class DelegateOrdersService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly orders: OrdersService,
    private readonly orderStatus: OrderStatusService,
    private readonly failedDeliveries: FailedDeliveriesService,
    private readonly messaging: MessagingService,
    private readonly quickMessage: QuickMessageService,
    private readonly deliveryPinShare: DeliveryPinShareService,
    private readonly acceptance: OrderAcceptanceService
  ) {}

  actor(ctx: DelegationAccessContext): AuthorizedBusinessActor {
    return {
      userId: ctx.userId,
      businessId: ctx.businessId,
      locationId: ctx.locationId,
    };
  }

  async pendingAcceptance(ctx: DelegationAccessContext) {
    await this.assertLocation(ctx);
    return this.acceptance.getPendingAcceptanceForLocation(
      ctx.businessId,
      ctx.locationId
    );
  }

  async markBusy(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.acceptance.markBusy(orderId, {
      userId: ctx.userId,
      asDelegateLocationId: ctx.locationId,
    });
  }

  async list(ctx: DelegationAccessContext, filters?: unknown) {
    await this.assertLocation(ctx);
    const result = await this.hasura.executeQuery<{ orders: unknown[] }>(
      GET_ORDERS,
      { filters: { business_location_id: { _eq: ctx.locationId } } }
    );
    return this.applyFilters(result.orders ?? [], filters);
  }

  async getById(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.getOrderById(orderId, this.actor(ctx));
  }

  async confirm(ctx: DelegationAccessContext, request: ConfirmOrderRequest) {
    await this.requireOrderInLocation(ctx, request.orderId);
    return this.orders.confirmOrder(request, this.actor(ctx));
  }

  async completePreparation(
    ctx: DelegationAccessContext,
    request: OrderStatusChangeRequest
  ) {
    await this.requireOrderInLocation(ctx, request.orderId);
    return this.orders.completePreparation(request, this.actor(ctx));
  }

  async completePreparationBatch(
    ctx: DelegationAccessContext,
    request: BatchOrderStatusChangeRequest
  ) {
    for (const orderId of request.orderIds ?? []) {
      await this.requireOrderInLocation(ctx, orderId);
    }
    return this.orders.completePreparationBatch(request, this.actor(ctx));
  }

  async cancel(ctx: DelegationAccessContext, request: OrderStatusChangeRequest) {
    await this.requireOrderInLocation(ctx, request.orderId);
    return this.orders.cancelOrder(request, this.actor(ctx));
  }

  async cancellationPreview(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.getCancellationPreview(orderId, this.actor(ctx));
  }

  async updateStatus(ctx: DelegationAccessContext, orderId: string, status: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.applyStatusChange(ctx, orderId, status);
  }

  /**
   * Generic PATCH must not flip money/dispatch statuses without side effects.
   * Cancel releases Stripe/wallet holds + inventory; ready_for_pickup schedules
   * agent dispatch and pickup PINs; confirm requires a time slot.
   */
  private applyStatusChange(
    ctx: DelegationAccessContext,
    orderId: string,
    status: string
  ) {
    if (status === 'cancelled') {
      // Delegate manually cancelling via generic status PATCH → use reason 13 (cannot_fulfill_order)
      // for business-initiated cancel without collected reason
      return this.orders.cancelOrder(
        { orderId, cancellationReasonId: 13, notes: 'Cancelled by business delegate' },
        this.actor(ctx)
      );
    }
    if (status === 'ready_for_pickup') {
      return this.orders.completePreparation({ orderId }, this.actor(ctx));
    }
    if (status === 'confirmed') {
      throw new Error(
        'Use POST /delegate/orders/confirm with a time slot; PATCH status=confirmed is unsafe'
      );
    }
    return this.orderStatus.updateOrderStatus(orderId, status, this.actor(ctx)).then(
      (order) => ({ success: true, order, message: 'Order status updated successfully' })
    );
  }

  async confirmPickup(
    ctx: DelegationAccessContext,
    orderId: string,
    body: { pin?: string; useLatestSharedPin?: boolean; pinMessageId?: string }
  ) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.confirmClientPickup(orderId, body?.pin ?? '', {
      useLatestSharedPin: body?.useLatestSharedPin,
      pinMessageId: body?.pinMessageId,
      actor: this.actor(ctx),
    });
  }

  async markShipped(
    ctx: DelegationAccessContext,
    orderId: string,
    body?: { tracking_number?: string; carrier?: string }
  ) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.markOrderAsShipped(
      orderId,
      body?.tracking_number,
      body?.carrier,
      this.actor(ctx)
    );
  }

  async updateTracking(
    ctx: DelegationAccessContext,
    orderId: string,
    body: { tracking_number: string; carrier?: string }
  ) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.updateTrackingNumber(
      orderId,
      body.tracking_number,
      body?.carrier,
      this.actor(ctx)
    );
  }

  async pickupNotReady(
    ctx: DelegationAccessContext,
    orderId: string,
    extraMinutes?: number
  ) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.markPickupNotReady(orderId, extraMinutes, this.actor(ctx));
  }

  async pickupResume(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.resumePickupMonitoring(orderId, this.actor(ctx));
  }

  async initiatePayAtPickup(
    ctx: DelegationAccessContext,
    orderId: string,
    phone?: string
  ) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.initiatePayAtPickupPayment(
      orderId,
      phone,
      this.actor(ctx)
    );
  }

  async events(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.orders.getOrderEvents(orderId, this.actor(ctx));
  }

  async messages(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.messaging.getOrderMessagesForActor(orderId, this.actor(ctx));
  }

  async createMessage(
    ctx: DelegationAccessContext,
    orderId: string,
    message: string,
    mentionedUserId?: string
  ) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.messaging.createOrderMessageForActor(
      orderId,
      message,
      this.actor(ctx),
      mentionedUserId
    );
  }

  async mentionable(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.messaging.getMentionableParticipantsForActor(
      orderId,
      this.actor(ctx)
    );
  }

  async quickTemplates(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.quickMessage.listEligibleTemplatesForActor(
      orderId,
      this.actor(ctx)
    );
  }

  async sendQuick(
    ctx: DelegationAccessContext,
    orderId: string,
    templateKey: string
  ) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.quickMessage.sendQuickMessageForActor(
      orderId,
      templateKey,
      this.actor(ctx)
    );
  }

  async activeDeliveryPin(ctx: DelegationAccessContext, orderId: string) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.deliveryPinShare.getActiveDeliveryPinForLocation(
      orderId,
      ctx.businessId
    );
  }

  async listFailedDeliveries(
    ctx: DelegationAccessContext,
    filters?: { status?: 'pending' | 'completed'; resolution_type?: string }
  ) {
    return this.failedDeliveries.getFailedDeliveriesForLocation(
      ctx.businessId,
      ctx.locationId,
      filters
    );
  }

  async resolveFailedDelivery(
    ctx: DelegationAccessContext,
    orderId: string,
    resolution: ResolutionRequest
  ) {
    await this.requireOrderInLocation(ctx, orderId);
    return this.failedDeliveries.resolveFailedDeliveryForActor(
      orderId,
      resolution,
      this.actor(ctx)
    );
  }

  async actionsNeeded(ctx: DelegationAccessContext) {
    const result = await this.hasura.executeQuery<{
      orders: Array<{
        id: string;
        order_number: string;
        current_status: string;
        created_at: string;
        total_amount: number;
        currency: string;
      }>;
    }>(
      `
      query DelegateActionsNeeded($locationId: uuid!) {
        orders(
          where: {
            business_location_id: { _eq: $locationId }
            current_status: { _in: ["pending", "confirmed", "preparing"] }
          }
          order_by: { created_at: asc }
        ) {
          id order_number current_status created_at total_amount currency
        }
      }
    `,
      { locationId: ctx.locationId }
    );
    return { pending_orders: result.orders ?? [] };
  }

  private async assertLocation(ctx: DelegationAccessContext) {
    const result = await this.hasura.executeQuery<{
      business_locations_by_pk: { id: string; business_id: string } | null;
    }>(
      `
      query DelegateLocation($id: uuid!) {
        business_locations_by_pk(id: $id) { id business_id }
      }
    `,
      { id: ctx.locationId }
    );
    const location = result.business_locations_by_pk;
    if (!location || location.business_id !== ctx.businessId) {
      throw new HttpException('Location is no longer valid', HttpStatus.FORBIDDEN);
    }
  }

  private async requireOrderInLocation(
    ctx: DelegationAccessContext,
    orderId: string
  ) {
    const result = await this.hasura.executeQuery<{
      orders_by_pk: {
        id: string;
        business_id: string;
        business_location_id: string;
      } | null;
    }>(
      `
      query DelegateOrderScope($id: uuid!) {
        orders_by_pk(id: $id) { id business_id business_location_id }
      }
    `,
      { id: orderId }
    );
    const order = result.orders_by_pk;
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    if (
      order.business_id !== ctx.businessId ||
      order.business_location_id !== ctx.locationId
    ) {
      throw new HttpException(
        'Order is not in the active delegation location',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private applyFilters(orders: unknown[], filters?: unknown): unknown[] {
    if (!filters || typeof filters !== 'object') return orders;
    const status = (filters as { current_status?: string; status?: string })
      .current_status || (filters as { status?: string }).status;
    if (!status) return orders;
    return (orders as Array<{ current_status?: string }>).filter(
      (order) => order.current_status === status
    );
  }
}
