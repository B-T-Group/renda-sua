import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrderStatusService } from '../orders/order-status.service';
import { OrdersService } from '../orders/orders.service';
import { SupportService } from '../support/support.service';
import { isActivePersona } from '../users/persona.util';
import {
  AWAITING_CLIENT_CONFIRMATION,
  DISPUTED,
  NONSTRIPE_REMINDER_1H_HOURS,
  NONSTRIPE_REMINDER_24H_HOURS,
  PENDING_AUTO_COMPLETE,
  type DeliveryConfirmationMethod,
} from './client-confirm-delivery.constants';
import {
  CLIENT_CONFIRM_COPY,
  withHours,
} from './client-confirm-copy';
import { ClientConfirmMarketConfigService } from './client-confirm-market-config.service';
import { ClientConfirmDeliveryRepository } from './client-confirm-delivery.repository';
import {
  ConfirmReceiptResult,
  ClientConfirmOrder,
  DeliveryConfirmationState,
  DeliveryProofPhotoInput,
  RecipientDeliveryAction,
  RecipientProblemResult,
} from './client-confirm-delivery.types';
import {
  canConfirmFromStatus,
  graceElapsed,
  hoursFromNow,
  isClientConfirmDeliveryOrder,
  isAwaitingClientConfirmation,
  usesLegacyDeliveryPin,
} from './client-confirm-delivery.util';
import { OrderRecipientNotificationsService } from '../notifications/order-recipient-notifications.service';

@Injectable()
export class ClientConfirmDeliveryService {
  private readonly logger = new Logger(ClientConfirmDeliveryService.name);

  constructor(
    private readonly users: HasuraUserService,
    private readonly repo: ClientConfirmDeliveryRepository,
    private readonly marketConfig: ClientConfirmMarketConfigService,
    private readonly orderStatus: OrderStatusService,
    @Inject(forwardRef(() => OrdersService))
    private readonly orders: OrdersService,
    private readonly support: SupportService,
    private readonly recipientNotifications: OrderRecipientNotificationsService
  ) {}

  async markDelivered(orderId: string) {
    const { user, agentId } = await this.requireAssignedAgent(orderId);
    const order = await this.requireOrder(orderId);
    this.assertNotLegacyPin(order);
    this.assertOutForDelivery(order);
    await this.orderStatus.updateOrderStatus(orderId, AWAITING_CLIENT_CONFIRMATION, {
      viaSystem: true,
    });
    await this.afterMarkDeliveredCommitted(order, user.id);
    return {
      success: true,
      status: AWAITING_CLIENT_CONFIRMATION,
      agentId,
      message: CLIENT_CONFIRM_COPY.agentWaiting.en,
    };
  }

  async confirmReceipt(
    orderId: string,
    method: DeliveryConfirmationMethod = 'client'
  ): Promise<ConfirmReceiptResult> {
    const order = await this.requireOrder(orderId);
    if (order.fulfillment_method === 'shipping') {
      const shipping = await this.orders.confirmOrderReceipt(orderId);
      return {
        success: true,
        alreadyComplete: order.current_status === 'complete',
        orderId,
        status: shipping?.order?.current_status || 'complete',
        message: shipping?.message || CLIENT_CONFIRM_COPY.confirmDone.en,
      };
    }
    if (order.current_status === 'complete') {
      return {
        success: true,
        alreadyComplete: true,
        orderId,
        status: 'complete',
        message: CLIENT_CONFIRM_COPY.confirmDone.en,
        confirmationMethod:
          (order.delivery_confirmation_method as DeliveryConfirmationMethod) ||
          method,
      };
    }
    this.assertConfirmable(order);
    const resolved =
      method === 'client' && order.is_third_party_recipient ? 'buyer' : method;
    await this.assertConfirmerAllowed(order, resolved);
    const stamped = await this.repo.stampConfirmationMethod(
      orderId,
      resolved,
      new Date().toISOString()
    );
    const result = await this.orders.completeAfterClientConfirmation(
      orderId,
      this.completeHistory(resolved),
      this.confirmChangedByType(resolved)
    );
    return {
      success: true,
      alreadyComplete: result.alreadyComplete,
      orderId,
      status: 'complete',
      message: CLIENT_CONFIRM_COPY.confirmDone.en,
      confirmationMethod: await this.methodFromStamp(orderId, stamped, resolved),
    };
  }

  async reportProblem(orderId: string, description?: string) {
    const user = await this.users.getUser();
    const order = await this.requireOrder(orderId);
    if (order.current_status === DISPUTED) {
      return {
        success: true,
        status: DISPUTED,
        ticketId: order.awaiting_confirm_support_ticket_id,
        message: 'Delivery reported as a problem. Support will follow up.',
      };
    }
    this.assertConfirmable(order);
    await this.assertConfirmerAllowed(order, 'client');
    await this.transition(
      orderId,
      DISPUTED,
      description?.trim() || 'Client reported a delivery problem',
      user.id,
      'client'
    );
    const ticket = await this.openDisputeTicket(order, user.id, description);
    return {
      success: true,
      status: DISPUTED,
      ticketId: ticket.id,
      message: 'Delivery reported as a problem. Support will follow up.',
    };
  }

  async submitCouldNotConfirm(
    orderId: string,
    photos: DeliveryProofPhotoInput[]
  ) {
    const { user, agentId } = await this.requireAssignedAgent(orderId);
    const order = await this.requireOrder(orderId);
    this.assertNotLegacyPin(order);
    this.assertAwaiting(order);
    const market = await this.marketConfig.forOrder(order);
    this.assertStripeFallbackAllowed(order, market, photos);
    const at = new Date();
    const deadline = hoursFromNow(market.autoCompleteHours, at);
    await this.repo.insertProofPhotos(orderId, agentId, photos);
    await this.repo.stampFallback(orderId, deadline.toISOString(), at.toISOString());
    await this.transition(
      orderId,
      PENDING_AUTO_COMPLETE,
      'Agent submitted photo proof; pending auto-complete',
      user.id,
      'agent'
    );
    await this.notifyGiftRecipient(order);
    return {
      success: true,
      status: PENDING_AUTO_COMPLETE,
      autoCompleteDeadlineAt: deadline.toISOString(),
      autoCompleteHours: market.autoCompleteHours,
      message: withHours(
        CLIENT_CONFIRM_COPY.agentFallbackDone.en,
        market.autoCompleteHours
      ),
    };
  }

  async getState(orderId: string): Promise<DeliveryConfirmationState> {
    const order = await this.requireOrder(orderId);
    const market = await this.marketConfig.forOrder(order);
    const photos = await this.repo.listProofPhotos(orderId);
    const elapsed = graceElapsed(
      order.client_confirmation_requested_at,
      market.graceMinutes
    );
    const canSubmitFallback =
      isClientConfirmDeliveryOrder(order) &&
      isAwaitingClientConfirmation(order.current_status) &&
      market.isStripeRail &&
      elapsed;
    return {
      orderId,
      status: order.current_status,
      usesLegacyPin: usesLegacyDeliveryPin(order),
      isClientConfirmFlow: isClientConfirmDeliveryOrder(order),
      isStripeRail: market.isStripeRail,
      graceElapsed: elapsed,
      graceMinutes: market.graceMinutes,
      autoCompleteHours: market.autoCompleteHours,
      autoCompleteDeadlineAt: order.auto_complete_deadline_at ?? null,
      requestedAt: order.client_confirmation_requested_at ?? null,
      canSubmitFallback,
      agentMessageKey: this.agentMessageKey(order, market, canSubmitFallback),
      giftBuyerCanConfirm: market.giftBuyerCanConfirm,
      photos: photos.map((p) => ({
        photoUrl: p.photo_url,
        capturedAt: p.captured_at,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        agentId: p.agent_id ?? null,
      })),
      market,
    };
  }

  async handleRecipientAction(
    orderId: string,
    fromPhone: string,
    action: RecipientDeliveryAction
  ): Promise<ConfirmReceiptResult | RecipientProblemResult> {
    const order = await this.requireOrder(orderId);
    if (!this.phonesMatch(fromPhone, order.recipient_phone)) {
      throw new HttpException('Recipient phone does not match', HttpStatus.FORBIDDEN);
    }
    if (action === 'problem') {
      return this.handleRecipientProblem(order);
    }
    return this.confirmReceipt(orderId, 'recipient');
  }

  async autoCompleteDue(now: Date = new Date()): Promise<{ completed: number }> {
    const ids = await this.repo.dueAutoComplete(now.toISOString(), 50);
    let completed = 0;
    for (const id of ids) {
      if (await this.autoCompleteOne(id, now)) completed += 1;
    }
    return { completed };
  }

  async processNonStripeStuck(now: Date = new Date()): Promise<{
    reminded1h: number;
    reminded24h: number;
    tickets: number;
  }> {
    const counts = { reminded1h: 0, reminded24h: 0, tickets: 0 };
    const cutoff = new Date(now.getTime() - 60 * 60_000).toISOString();
    for (const order of await this.repo.awaitingSince(cutoff, 50)) {
      await this.processStuckOrder(order, now, counts);
    }
    return counts;
  }

  async enterAwaitingAfterPayment(orderId: string, history: string): Promise<void> {
    const order = await this.requireOrder(orderId);
    if (usesLegacyDeliveryPin(order)) {
      await this.orders.completeAfterClientConfirmation(orderId, history);
      return;
    }
    if (order.current_status === AWAITING_CLIENT_CONFIRMATION) return;
    if (order.current_status === 'complete') return;
    await this.transition(orderId, AWAITING_CLIENT_CONFIRMATION, history);
    await this.repo.stampRequestedAt(orderId, new Date().toISOString());
    await this.notifyGiftRecipient(order);
  }

  private async autoCompleteOne(orderId: string, now: Date): Promise<boolean> {
    const order = await this.repo.loadOrder(orderId);
    if (!order || order.current_status !== PENDING_AUTO_COMPLETE) return false;
    const stamped = await this.repo.stampConfirmationMethod(
      orderId,
      'auto_complete',
      now.toISOString()
    );
    await this.orders.completeAfterClientConfirmation(
      orderId,
      stamped
        ? 'Auto-completed after photo fallback deadline'
        : 'Completed after photo fallback (confirmation method already recorded)'
    );
    return true;
  }

  private async handleRecipientProblem(
    order: ClientConfirmOrder
  ): Promise<RecipientProblemResult> {
    if (usesLegacyDeliveryPin(order)) {
      return {
        success: false,
        status: order.current_status,
        message: 'This order uses the delivery PIN flow until it is complete',
      };
    }
    if (order.current_status === DISPUTED) {
      return {
        success: true,
        status: DISPUTED,
        ticketId: order.awaiting_confirm_support_ticket_id,
        message: 'Delivery reported as a problem. Support will follow up.',
      };
    }
    if (order.current_status === 'complete') {
      return this.openPostCompletionClaim(order);
    }
    if (!canConfirmFromStatus(order.current_status)) {
      return {
        success: false,
        status: order.current_status,
        message: `Cannot report a delivery problem in ${order.current_status} status`,
      };
    }
    return this.disputeFromRecipient(order);
  }

  private async disputeFromRecipient(
    order: ClientConfirmOrder
  ): Promise<RecipientProblemResult> {
    const actor = order.client?.user_id ?? order.client_id ?? order.id;
    await this.transition(
      order.id,
      DISPUTED,
      'Gift recipient reported a delivery problem',
      actor,
      'client'
    );
    const ticket = await this.openDisputeTicket(
      order,
      actor,
      'Recipient reported a problem via WhatsApp/SMS'
    );
    return {
      success: true,
      status: DISPUTED,
      ticketId: ticket.id,
      message: 'Delivery reported as a problem. Support will follow up.',
    };
  }

  private async openPostCompletionClaim(
    order: ClientConfirmOrder
  ): Promise<RecipientProblemResult> {
    const ticket = await this.support.createTicket(
      order.client?.user_id ?? order.client_id ?? order.id,
      {
        orderId: order.id,
        type: 'complaint',
        subject: `Post-delivery problem — ${order.order_number ?? order.id}`,
        description:
          'Gift recipient reported a problem after the order was already complete',
      }
    );
    return {
      success: true,
      status: 'complete',
      ticketId: ticket.id,
      postCompletionClaim: true,
      message: 'Order is already complete. Support will review the claim.',
    };
  }

  private async methodFromStamp(
    orderId: string,
    stamped: boolean,
    intended: DeliveryConfirmationMethod
  ): Promise<DeliveryConfirmationMethod> {
    if (stamped) return intended;
    const latest = await this.repo.loadOrder(orderId);
    const existing = latest?.delivery_confirmation_method;
    return (existing as DeliveryConfirmationMethod) || intended;
  }

  private async processStuckOrder(
    order: ClientConfirmOrder,
    now: Date,
    counts: { reminded1h: number; reminded24h: number; tickets: number }
  ): Promise<void> {
    const market = await this.marketConfig.forOrder(order);
    if (market.isStripeRail) return;
    const requested = Date.parse(order.client_confirmation_requested_at ?? '');
    if (Number.isNaN(requested)) return;
    const hours = (now.getTime() - requested) / 3_600_000;
    if (hours >= market.nonStripeSupportHours && !order.awaiting_confirm_support_ticket_id) {
      await this.escalateStuck(order, now);
      counts.tickets += 1;
      return;
    }
    if (hours >= NONSTRIPE_REMINDER_24H_HOURS && !order.awaiting_confirm_reminder_24h_at) {
      await this.repo.stampReminder(order.id, 'awaiting_confirm_reminder_24h_at', now.toISOString());
      counts.reminded24h += 1;
      return;
    }
    if (hours >= NONSTRIPE_REMINDER_1H_HOURS && !order.awaiting_confirm_reminder_1h_at) {
      await this.repo.stampReminder(order.id, 'awaiting_confirm_reminder_1h_at', now.toISOString());
      counts.reminded1h += 1;
    }
  }

  private async escalateStuck(order: ClientConfirmOrder, now: Date): Promise<void> {
    const ticket = await this.openDisputeTicket(
      order,
      order.client?.user_id ?? order.client_id ?? order.id,
      'Non-Stripe order still awaiting client confirmation after the support SLA'
    );
    await this.repo.stampSupportTicket(order.id, ticket.id, now.toISOString());
  }

  private async transition(
    orderId: string,
    status: string,
    history: string,
    actorUserId?: string,
    changedByType: string = 'system'
  ): Promise<void> {
    await this.orderStatus.updateOrderStatus(orderId, status, {
      viaSystem: true,
    });
    await this.orders.recordClientConfirmHistory(
      orderId,
      status,
      history,
      actorUserId,
      changedByType
    );
  }

  private async requireOrder(orderId: string): Promise<ClientConfirmOrder> {
    const order = await this.repo.loadOrder(orderId);
    if (!order) throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    return order;
  }

  private async requireAssignedAgent(orderId: string) {
    const user = await this.users.getUser();
    if (!isActivePersona(user, 'agent') || !user.agent?.id) {
      throw new HttpException('Only the assigned agent can do this', HttpStatus.FORBIDDEN);
    }
    const order = await this.requireOrder(orderId);
    if (order.assigned_agent_id !== user.agent.id) {
      throw new HttpException('Only the assigned agent can do this', HttpStatus.FORBIDDEN);
    }
    if (order.assigned_agent?.status === 'suspended') {
      throw new HttpException('Your account is suspended', HttpStatus.FORBIDDEN);
    }
    return { user, agentId: user.agent.id as string, order };
  }

  private async afterMarkDeliveredCommitted(
    order: ClientConfirmOrder,
    actorUserId: string
  ): Promise<void> {
    await this.safeAfterCommit('history', () =>
      this.orders.recordClientConfirmHistory(
        order.id,
        AWAITING_CLIENT_CONFIRMATION,
        'Agent marked delivered; awaiting client confirmation',
        actorUserId,
        'agent'
      )
    );
    await this.safeAfterCommit('requested_at', () =>
      this.repo.stampRequestedAt(order.id, new Date().toISOString())
    );
    await this.notifyGiftRecipient(order);
  }

  private async safeAfterCommit(
    name: string,
    run: () => Promise<void>
  ): Promise<void> {
    try {
      await run();
    } catch (error: any) {
      this.logger.warn(`mark-delivered ${name} failed after commit: ${error?.message}`);
    }
  }

  private assertOutForDelivery(order: ClientConfirmOrder): void {
    if (order.current_status === 'out_for_delivery') return;
    throw new HttpException(
      `Cannot mark delivered in ${order.current_status} status`,
      HttpStatus.BAD_REQUEST
    );
  }

  private assertNotLegacyPin(order: ClientConfirmOrder): void {
    if (usesLegacyDeliveryPin(order)) {
      throw new HttpException(
        'This order uses the delivery PIN flow until it is complete',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertConfirmable(order: ClientConfirmOrder): void {
    this.assertNotLegacyPin(order);
    if (!canConfirmFromStatus(order.current_status)) {
      throw new HttpException(
        `Cannot confirm delivery in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertAwaiting(order: ClientConfirmOrder): void {
    if (!isAwaitingClientConfirmation(order.current_status)) {
      throw new HttpException(
        'Fallback is only available while awaiting client confirmation',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertStripeFallbackAllowed(
    order: ClientConfirmOrder,
    market: { isStripeRail: boolean; graceMinutes: number },
    photos: DeliveryProofPhotoInput[]
  ): void {
    if (!market.isStripeRail) {
      throw new HttpException(
        CLIENT_CONFIRM_COPY.agentNonStripe.en,
        HttpStatus.FORBIDDEN
      );
    }
    if (!graceElapsed(order.client_confirmation_requested_at, market.graceMinutes)) {
      throw new HttpException(
        'Wait for the grace period before submitting photo proof',
        HttpStatus.BAD_REQUEST
      );
    }
    if (!photos?.length || photos.some((p) => !p.photoUrl?.trim())) {
      throw new HttpException(
        'At least one photo with timestamp and GPS is required',
        HttpStatus.BAD_REQUEST
      );
    }
    this.assertPhotoMeta(photos);
  }

  private assertPhotoMeta(photos: DeliveryProofPhotoInput[]): void {
    for (const photo of photos) {
      if (!photo.capturedAt || photo.latitude == null || photo.longitude == null) {
        throw new HttpException(
          'Each photo must include capturedAt, latitude, and longitude',
          HttpStatus.BAD_REQUEST
        );
      }
    }
  }

  private async assertConfirmerAllowed(
    order: ClientConfirmOrder,
    method: DeliveryConfirmationMethod
  ): Promise<void> {
    if (method === 'recipient' || method === 'auto_complete') return;
    const user = await this.users.getUser();
    const isClient =
      isActivePersona(user, 'client') && order.client?.user_id === user.id;
    if (!isClient) {
      throw new HttpException('Only the client can confirm this order', HttpStatus.FORBIDDEN);
    }
    if (order.is_third_party_recipient) {
      const market = await this.marketConfig.forOrder(order);
      if (!market.giftBuyerCanConfirm) {
        throw new HttpException(
          'The gift buyer cannot confirm this order (OQ1 flag off)',
          HttpStatus.FORBIDDEN
        );
      }
    }
  }

  private async openDisputeTicket(
    order: ClientConfirmOrder,
    userId: string,
    description?: string
  ) {
    return this.support.createTicket(userId, {
      orderId: order.id,
      type: 'dispute',
      subject: `Delivery problem — ${order.order_number ?? order.id}`,
      description: description?.trim() || 'Client reported a problem at delivery',
    });
  }

  private async notifyGiftRecipient(order: ClientConfirmOrder): Promise<void> {
    if (!order.is_third_party_recipient) return;
    try {
      await this.recipientNotifications.notifyDeliveryConfirm(order.id);
    } catch (error: any) {
      this.logger.warn(
        `Gift confirm notify failed for ${order.id}: ${error?.message}`
      );
    }
  }

  private completeHistory(method: DeliveryConfirmationMethod): string {
    if (method === 'recipient') return 'Completed by gift recipient confirmation';
    if (method === 'buyer') return 'Completed by gift buyer on recipient behalf (OQ1)';
    if (method === 'auto_complete') return 'Auto-completed after photo fallback deadline';
    return 'Completed by client confirmation';
  }

  private confirmChangedByType(method: DeliveryConfirmationMethod): string {
    return method === 'auto_complete' ? 'system' : 'client';
  }

  private agentMessageKey(
    order: ClientConfirmOrder,
    market: { isStripeRail: boolean },
    canSubmitFallback: boolean
  ): DeliveryConfirmationState['agentMessageKey'] {
    if (canSubmitFallback) return 'agent.fallback.cta';
    if (!market.isStripeRail && isAwaitingClientConfirmation(order.current_status)) {
      return 'agent.nonstripe';
    }
    return 'agent.waiting';
  }

  private phonesMatch(a?: string | null, b?: string | null): boolean {
    const n = (v?: string | null) => (v || '').replace(/\D/g, '').replace(/^0+/, '');
    return !!n(a) && n(a) === n(b);
  }
}
