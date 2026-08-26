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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AdminOrderContactService } from './admin-order-contact.service';
import { AdminOrdersService } from './admin-orders.service';
import type { AdminOrderDetail, AdminOrdersResponse } from './admin-orders.types';
import {
  AcknowledgeRiskIncidentDto,
  AddAdminNoteDto,
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
import { OrderRiskMonitorService } from './order-risk-monitor.service';
import { OrdersService } from './orders.service';

/** Statuses support may correct manually; refunds stay on the refund flow. */
const CORRECTABLE_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'in_delivery',
  'delivered',
  'complete',
  'cancelled',
  'failed',
];

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
    private readonly adminOrderContactService: AdminOrderContactService
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
      this.logger.error('Failed to fetch admin orders', error);
      throw new HttpException(
        error.message || 'Failed to fetch orders',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':orderId')
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

  @Patch(':orderId/status')
  @ApiOperation({
    summary: 'Manually correct an order status',
    description:
      'Last-resort correction for stuck orders. The target status must be a supported operational status and the reason is recorded on the order timeline.',
  })
  @ApiParam({ name: 'orderId', description: 'Order id' })
  @ApiResponse({ status: 200, description: 'Status corrected' })
  @ApiResponse({ status: 400, description: 'Unsupported target status' })
  async updateStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    const order = await this.requireOrder(orderId);
    if (!CORRECTABLE_STATUSES.includes(dto.status)) {
      throw new HttpException(
        `Status "${dto.status}" cannot be set manually`,
        HttpStatus.BAD_REQUEST
      );
    }
    if (order.current_status === dto.status) {
      throw new HttpException(
        'Order is already in that status',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.applyStatusCorrection(orderId, order.current_status, dto);
    await this.riskMonitorService.evaluateOrderById(orderId);
    return { success: true, message: 'Status updated successfully' };
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
    const actor = await this.hasuraUserService.getUser();
    const incident = await this.riskIncidentsService.acknowledge({
      incidentId,
      userId: actor.id,
      note: dto.note,
      resolve: dto.resolve,
    });
    if (!incident) {
      throw new HttpException('Incident not found', HttpStatus.NOT_FOUND);
    }
    await this.orderEventsService.recordEvent({
      orderId: incident.order_id,
      eventType: dto.resolve
        ? 'risk_incident_resolved'
        : 'risk_incident_acknowledged',
      actorType: 'support',
      actorId: actor.id,
      payload: { incidentId, note: dto.note ?? null },
    });
    return { success: true, incident };
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

  private async applyStatusCorrection(
    orderId: string,
    fromStatus: string,
    dto: UpdateOrderStatusDto
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation AdminCorrectOrderStatus(
        $orderId: uuid!
        $status: order_status_enum!
        $fromStatus: order_status_enum!
        $notes: String
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { current_status: $status }
        ) { id current_status }
        insert_order_status_history_one(
          object: {
            order_id: $orderId
            from_status: $fromStatus
            to_status: $status
            notes: $notes
          }
        ) { id }
      }`,
      {
        orderId,
        status: dto.status,
        fromStatus,
        notes: `Admin correction: ${dto.reason}`,
      }
    );
    await this.recordIntervention(orderId, 'status_correction', {
      from_status: fromStatus,
      to_status: dto.status,
      reason: dto.reason,
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
