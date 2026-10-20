import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequirePermissions, RequireRoles } from '../rbac/permissions.decorator';
import { PlatformPermissions, PlatformRoles } from '../rbac/platform-permissions';
import { GeoScopeService } from '../rbac/geo-scope.service';
import { AdminOrderContactService } from './admin-order-contact.service';
import { AdminOrdersService } from './admin-orders.service';
import type {
  AdminOrderDetail,
  AdminOrdersResponse,
  AdminOrderStatsResponse,
} from './admin-orders.types';
import {
  AcknowledgeRiskIncidentDto,
  AddAdminNoteDto,
  AdminFullRefundCancelDto,
  AdminOrderStatsPeriod,
  GetAdminOrderStatsDto,
  GetAdminOrdersDto,
  SendOrderContactEmailDto,
  SendOrderContactMessageDto,
  SendOrderContactSmsDto,
  UnassignRedispatchDto,
  UpdateOrderStatusDto,
  type OrderContactRecipientType,
} from './dto/admin-orders.dto';
import { OrderEventsService } from './order-events.service';
import { OrderReassignmentService } from './order-reassignment.service';
import { OrderRiskIncidentsService } from './order-risk-incidents.service';
import type { OrderRiskIncident } from './order-risk.types';
import { OrderRiskMonitorService } from './order-risk-monitor.service';
import { OrdersService, type DepositCancelOutcome } from './orders.service';
import { CreditsService } from '../credits/credits.service';
import type {
  CreditContactChannel,
  CreditOrderResult,
} from '../credits/credit.types';
import { isAdminOperationalStatus } from './admin-order-status.util';
import { safeErrorMessage } from '../common/utils/safe-error-log.util';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { maskPersonalData } from '../common/sentry/scrub-sentry-event';

/** The full-refund cancel succeeded but its audit event could not be written. */
export const FULL_REFUND_CANCEL_AUDIT_FAILED_MARKER = 'admin_full_refund_cancel_audit_failed';

@ApiTags('admin/orders')
@Controller('admin/orders')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
@RequirePermissions(PlatformPermissions.ORDERS_CROSS_BUSINESS)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminOrdersController {
  private readonly logger = new Logger(AdminOrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly adminOrdersService: AdminOrdersService,
    private readonly orderReassignmentService: OrderReassignmentService,
    private readonly orderEventsService: OrderEventsService,
    private readonly riskIncidentsService: OrderRiskIncidentsService,
    private readonly riskMonitorService: OrderRiskMonitorService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly notificationsService: NotificationsService,
    private readonly adminOrderContactService: AdminOrderContactService,
    private readonly creditsService: CreditsService,
    private readonly geo: GeoScopeService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Order operations queue',
    description:
      'Attention-first list of orders with open risk incidents, contacts, and permitted interventions. Pass queue=all for every active order.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated orders with risk incidents and queue counts',
    schema: {
      type: 'object',
      properties: {
        orders: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        offset: { type: 'number' },
        limit: { type: 'number' },
        counts: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            at_risk: { type: 'number' },
            critical: { type: 'number' },
            warning: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Missing platform.orders.cross_business' })
  async getAdminOrders(
    @Query() query: GetAdminOrdersDto
  ): Promise<AdminOrdersResponse> {
    try {
      return await this.adminOrdersService.list(query);
    } catch (error: any) {
      this.logger.error('Failed to fetch admin orders', safeErrorMessage(error));
      throw new HttpException(
        error.message || 'Failed to fetch orders',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Platform-wide order statistics',
    description:
      'Status totals, completion and cancellation rates, and average acceptance, prep, delivery, and end-to-end completion times for the selected period.',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: AdminOrderStatsPeriod,
    description: 'Window applied to order creation date. Defaults to 7d.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order statistics for the selected period',
    schema: {
      type: 'object',
      properties: {
        period: { type: 'string' },
        since: { type: 'string', nullable: true },
        counts: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            completed: { type: 'number' },
            in_progress: { type: 'number' },
            cancelled: { type: 'number' },
            failed: { type: 'number' },
            refunds: { type: 'number' },
            pending_payment: { type: 'number' },
          },
        },
        rates: {
          type: 'object',
          properties: {
            completion_rate: { type: 'number', nullable: true },
            cancellation_rate: { type: 'number', nullable: true },
          },
        },
        averages: {
          type: 'object',
          properties: {
            completion_minutes: { type: 'number', nullable: true },
            acceptance_minutes: { type: 'number', nullable: true },
            prep_minutes: { type: 'number', nullable: true },
            delivery_minutes: { type: 'number', nullable: true },
            sample_size: { type: 'number' },
            samples: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Missing platform.orders.cross_business' })
  async getAdminOrderStats(
    @Query() query: GetAdminOrderStatsDto
  ): Promise<AdminOrderStatsResponse> {
    try {
      return await this.adminOrdersService.getStats(query);
    } catch (error: any) {
      this.logger.error('Failed to fetch admin order stats', safeErrorMessage(error));
      throw new HttpException(
        error.message || 'Failed to fetch order statistics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':orderId')
  @RequirePermissions(
    PlatformPermissions.ORDERS_CROSS_BUSINESS,
    PlatformPermissions.OPS_CREDITS
  )
  @ApiOperation({
    summary: 'Superuser order intervention detail',
    description:
      'Full order context for cross-business support: risk incidents, SLA timing, operational timeline, message history, and permitted actions.',
  })
  @ApiParam({ name: 'orderId', description: 'Order id' })
  @ApiResponse({ status: 200, description: 'Order intervention detail' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getAdminOrderDetail(
    @Param('orderId') orderId: string
  ): Promise<AdminOrderDetail> {
    return this.adminOrdersService.getDetail(orderId);
  }

  @Post(':orderId/unassign-redispatch')
  @ApiOperation({
    summary: 'Redispatch an order to nearby agents',
    description:
      'For an assigned order, unassigns the current agent and releases their hold before redispatching. For a delivery order still waiting in ready_for_pickup with no agent, re-opens the dispatch rounds. If no agents are available after exhausting dispatch rounds, the client is offered store pickup.',
  })
  @ApiParam({ name: 'orderId', description: 'Order id' })
  @ApiResponse({ status: 200, description: 'Order redispatched' })
  @ApiResponse({ status: 400, description: 'Order is not in a redispatchable state' })
  async unassignAndRedispatch(
    @Param('orderId') orderId: string,
    @Body() dto: UnassignRedispatchDto
  ) {
    const order = await this.requireOrder(orderId);
    const reason = dto.reason || 'Admin-initiated reassignment';
    const result = await this.dispatchForStatus(order, orderId, reason);
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }
    await this.recordIntervention(orderId, 'unassign_redispatch', {
      reason,
      from_status: order.current_status,
    });
    await this.riskMonitorService.evaluateOrderById(orderId);
    return result;
  }

  /** Assigned orders drop their agent first; unassigned ready orders just re-dispatch. */
  private async dispatchForStatus(
    order: any,
    orderId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    if (order.current_status === 'assigned_to_agent') {
      return this.orderReassignmentService.reassignOrder(orderId, reason, {
        skipReliabilityPenalty: true,
      });
    }
    if (order.current_status === 'ready_for_pickup') {
      return this.orderReassignmentService.redispatchUnassignedOrder(
        orderId,
        reason
      );
    }
    return {
      success: false,
      message: `Order in status "${order.current_status}" cannot be redispatched`,
    };
  }

  /**
   * Ops cleanup: cancel an order with a FULL refund to the client and release any
   * agent hold. Superuser, or an admin holding platform.financial.refunds (in geo
   * scope); the class-level ORDERS_CROSS_BUSINESS alone is not enough.
   *
   * Money: the cancel is recorded as cancelled_by=system, which the order.cancelled
   * Lambda never charges a cancellation fee for, and whose client and agent releases
   * use the per-order `cancel_release_key_prefix` idempotency keys (exactly once,
   * even when the message is redelivered). A business or system cancel also refunds
   * a paid deposit, after the lock point too. The status write is a compare-and-set
   * on the status read, so of two concurrent calls one wins and the other gets 409
   * before any side effect.
   *
   * Where the money goes (QA A5): the refund is to the client's Rendasua WALLET, not
   * back to the payment provider. Funds held on the wallet are released to its
   * available balance and a paid deposit is credited back to the wallet; no MoMo /
   * provider payout is made (the client withdraws as usual). A card authorisation is
   * voided rather than captured.
   *
   * The deposit refund result is returned as `depositRefund` (QA A2): when it failed
   * or was refused the response says so and a money alert is raised; it never claims
   * a full refund that did not happen.
   *
   * Audit: an `admin_intervention` order event (action full_refund_cancel, actor,
   * reason, previous status) plus a status-history entry. The free-text reason is
   * PII-masked (emails, phone numbers) before it is stored or logged (QA A4).
   */
  @Post(':orderId/full-refund-cancel')
  @RequireRoles(PlatformRoles.SUPERUSER)
  @RequirePermissions(PlatformPermissions.FINANCIAL_REFUNDS)
  @ApiOperation({
    summary: 'Cancel with a full refund (ops cleanup)',
    description:
      'Superuser / financial-refunds admin only. No cancellation fee; the client is refunded to their Rendasua wallet (not to the payment provider) and agent holds are released exactly once. Only before pickup (pending_payment, pending, confirmed, preparing, ready_for_pickup, assigned_to_agent). The response carries depositRefund.status.',
  })
  @ApiResponse({ status: 201, description: 'Cancelled; refund queued (order.cancelled)' })
  @ApiResponse({ status: 409, description: 'Already cancelled / status moved / goods already picked up' })
  async fullRefundCancel(
    @Param('orderId') orderId: string,
    @Body() dto: AdminFullRefundCancelDto
  ) {
    const scope = await this.geo.require(PlatformPermissions.FINANCIAL_REFUNDS);
    await this.geo.assertOrder(scope, orderId);
    const reason = maskPersonalData(dto.reason);
    const result = await this.ordersService.adminFullRefundCancel(orderId, reason);
    await this.auditFullRefundCancel(orderId, reason, result.previousStatus, result.depositRefund, result.failedSteps);
    return result;
  }

  /**
   * The audit event after a successful full-refund cancel. The cancel (and its refund)
   * has already happened, so a failure here must not turn it into an error: it is
   * raised as an alert (`admin_full_refund_cancel_audit_failed`, Sentry + CloudWatch
   * marker) with who/what/why so the trail can be restored by hand. Written with
   * OrderEventsService.recordEventStrict (recordEvent swallows insert errors).
   */
  private async auditFullRefundCancel(
    orderId: string,
    reason: string,
    previousStatus: string,
    depositRefund: DepositCancelOutcome,
    failedSteps: Array<{ step: string; error: string }>
  ): Promise<void> {
    let actorId: string | null = null;
    try {
      actorId = (await this.hasuraUserService.getUser())?.id ?? null;
      await this.orderEventsService.recordEventStrict({
        orderId,
        eventType: 'admin_intervention',
        actorType: 'support',
        actorId,
        payload: { action: 'full_refund_cancel', reason, previousStatus, cancellationFee: 0, depositRefund, failedSteps },
      });
    } catch (error: unknown) {
      reportMoneyAnomaly(
        this.logger,
        FULL_REFUND_CANCEL_AUDIT_FAILED_MARKER,
        `Audit event not written for the full-refund cancel of order ${orderId} (the cancel succeeded): ${safeErrorMessage(error)}`,
        { orderId, actorId, previousStatus, reason }
      );
    }
  }

  @Patch(':orderId/status')
  @ApiOperation({
    summary: 'Override order status',
    description:
      'cancelled releases payment and restores inventory. Settlement statuses (delivered, picked_up, complete) are rejected.',
  })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Settlement status or invalid transition',
  })
  async updateStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    try {
      // Geo/scope check first, for EVERY status including cancel (F-CA1: a country admin must
      // never cancel an order outside their grants).
      const order = await this.requireOrder(orderId);
      if (dto.status === 'cancelled') {
        return await this.ordersService.cancelOrderAsAdmin(orderId, dto.notes);
      }
      this.assertOperationalAdminStatus(dto.status);
      await this.writeOperationalAdminStatus(order, dto);
      return {
        success: true,
        message: 'Status updated successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update status', safeErrorMessage(error));
      throw new HttpException(
        error.message || 'Failed to update status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private assertOperationalAdminStatus(status: string): void {
    if (isAdminOperationalStatus(status)) return;
    throw new HttpException(
      'Cannot set delivered, picked up, or complete via status override. Use the fulfillment flow so payment capture and settlement run.',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async writeOperationalAdminStatus(
    order: { id: string; current_status: string },
    dto: UpdateOrderStatusDto,
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `
      mutation AdminOperationalStatus(
        $orderId: uuid!
        $status: order_status!
        $previousStatus: order_status!
        $notes: String
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { current_status: $status }
        ) { id current_status }
        insert_order_status_history_one(
          object: {
            order_id: $orderId
            status: $status
            previous_status: $previousStatus
            changed_by_type: "system"
            notes: $notes
          }
        ) { id }
      }
      `,
      {
        orderId: order.id,
        status: dto.status,
        previousStatus: order.current_status,
        notes: dto.notes || 'Admin status override',
      },
    );
    await this.orderEventsService.recordEvent({
      orderId: order.id,
      eventType: 'gps_unavailable',
      actorType: 'support',
      payload: {
        old_status: order.current_status,
        new_status: dto.status,
        notes: dto.notes,
      },
    });
  }

  @Post(':orderId/notes')
  @ApiOperation({ summary: 'Add an audited support note to the order timeline' })
  @ApiParam({ name: 'orderId', description: 'Order id' })
  @ApiResponse({ status: 201, description: 'Note added successfully' })
  async addNote(
    @Param('orderId') orderId: string,
    @Body() dto: AddAdminNoteDto
  ) {
    await this.requireOrder(orderId);
    await this.recordIntervention(orderId, 'note', { note: dto.note });
    return { success: true, message: 'Note added successfully' };
  }

  @Post('risk-incidents/:incidentId/acknowledge')
  @ApiOperation({
    summary: 'Acknowledge (or resolve) an order risk incident',
    description:
      'Stops repeat superuser alerts for this incident while an operator works it. Escalation to critical still alerts.',
  })
  @ApiParam({ name: 'incidentId', description: 'Risk incident id' })
  @ApiResponse({ status: 200, description: 'Incident acknowledged' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async acknowledgeIncident(
    @Param('incidentId') incidentId: string,
    @Body() dto: AcknowledgeRiskIncidentDto
  ) {
    const scope = await this.geo.require(PlatformPermissions.ORDERS_CROSS_BUSINESS);
    await this.geo.assertIncident(scope, incidentId);
    const actor = await this.hasuraUserService.getUser();
    const { incident, applied } = await this.riskIncidentsService.acknowledge({
      incidentId,
      userId: actor.id,
      note: dto.note,
      resolve: dto.resolve,
      contactChannel: dto.contact_channel,
      orderResult: dto.order_result,
    });
    if (!incident) {
      throw new HttpException('Incident not found', HttpStatus.NOT_FOUND);
    }
    const credit = applied
      ? await this.recordAcknowledgeSideEffects(actor.id, incident, dto)
      : null;
    return { success: true, incident, credit };
  }

  @Post(':orderId/contact/message')
  @ApiOperation({ summary: 'Send in-app message to order participant' })
  @ApiParam({ name: 'orderId', description: 'Order id' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Missing message or recipient' })
  async sendMessage(
    @Param('orderId') orderId: string,
    @Body() body: SendOrderContactMessageDto
  ) {
    const order = await this.requireOrder(orderId);
    await this.adminOrderContactService.sendInAppMessage({
      order,
      message: body.message,
      recipientType: body.recipient_type,
    });
    await this.recordIntervention(orderId, 'message', {
      recipient: body.recipient_type,
    });
    return { success: true, message: 'Message sent successfully' };
  }

  @Post(':orderId/contact/email')
  @ApiOperation({ summary: 'Send email to order participant' })
  @ApiParam({ name: 'orderId', description: 'Order id' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 400, description: 'Recipient email not found' })
  async sendEmail(
    @Param('orderId') orderId: string,
    @Body() body: SendOrderContactEmailDto
  ) {
    const order = await this.requireOrder(orderId);
    const to = this.recipientUser(order, body.recipient_type)?.email;
    if (!to) {
      throw new HttpException('Recipient email not found', HttpStatus.BAD_REQUEST);
    }
    await this.notificationsService.sendMerchantEngagementHtmlEmail({
      to,
      subject: body.subject,
      html: body.message,
    });
    await this.recordIntervention(orderId, 'email', {
      recipient: body.recipient_type,
    });
    return { success: true, message: 'Email sent successfully' };
  }

  @Post(':orderId/contact/sms')
  @ApiOperation({ summary: 'Send SMS to order participant' })
  @ApiParam({ name: 'orderId', description: 'Order id' })
  @ApiResponse({ status: 200, description: 'SMS sent successfully' })
  @ApiResponse({ status: 400, description: 'Recipient phone not found' })
  async sendSms(
    @Param('orderId') orderId: string,
    @Body() body: SendOrderContactSmsDto
  ) {
    const order = await this.requireOrder(orderId);
    const phone = this.recipientUser(order, body.recipient_type)?.phone_number;
    if (!phone) {
      throw new HttpException('Recipient phone not found', HttpStatus.BAD_REQUEST);
    }
    await this.notificationsService.sendInternalSms(phone, body.message);
    await this.recordIntervention(orderId, 'sms', {
      recipient: body.recipient_type,
    });
    return { success: true, message: 'SMS sent successfully' };
  }

  private async requireOrder(orderId: string): Promise<any> {
    const scope = await this.geo.require(PlatformPermissions.ORDERS_CROSS_BUSINESS);
    await this.geo.assertOrder(scope, orderId);
    const order = await this.ordersService.getOrderById(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    return order;
  }

  private recipientUser(
    order: any,
    recipientType: OrderContactRecipientType
  ): { email?: string | null; phone_number?: string | null } | null {
    if (recipientType === 'client') return order.client?.user ?? null;
    if (recipientType === 'business') return order.business?.user ?? null;
    return order.assigned_agent?.user ?? null;
  }


  private async recordAcknowledgeSideEffects(
    actorId: string,
    incident: OrderRiskIncident,
    dto: AcknowledgeRiskIncidentDto
  ) {
    await this.orderEventsService.recordEvent({
      orderId: incident.order_id,
      eventType: dto.resolve
        ? 'risk_incident_resolved'
        : 'risk_incident_acknowledged',
      actorType: 'support',
      actorId,
      payload: {
        incidentId: incident.id,
        note: dto.note ?? null,
        contact_channel: dto.contact_channel ?? null,
        order_result: dto.order_result ?? null,
      },
    });
    return this.awardResolveCredit(actorId, incident, dto);
  }

  private async awardResolveCredit(
    actorId: string,
    incident: OrderRiskIncident,
    dto: AcknowledgeRiskIncidentDto
  ) {
    if (
      !dto.resolve ||
      !dto.contact_channel ||
      !dto.order_result ||
      !dto.note?.trim()
    ) {
      return null;
    }
    return this.creditsService.awardEscalationResolved({
      userId: actorId,
      incidentId: incident.id,
      orderId: incident.order_id,
      contactChannel: dto.contact_channel as CreditContactChannel,
      orderResult: dto.order_result as CreditOrderResult,
      notes: dto.note,
    });
  }

  /** Every superuser action lands on the order timeline with who and why. */
  private async recordIntervention(
    orderId: string,
    action: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const actor = await this.hasuraUserService.getUser().catch(() => null);
    await this.orderEventsService.recordEvent({
      orderId,
      eventType: 'admin_intervention',
      actorType: 'support',
      actorId: actor?.id ?? null,
      payload: { action, ...payload },
    });
  }
}
