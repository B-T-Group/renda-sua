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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { AdminOrderContactService } from './admin-order-contact.service';
import { OrdersService } from './orders.service';
import { OrderRiskService } from './order-risk.service';
import { OrderReassignmentService } from './order-reassignment.service';
import { OrderEventsService } from './order-events.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  GetAdminOrdersDto,
  UnassignRedispatchDto,
  UpdateOrderStatusDto,
  AddAdminNoteDto,
  SendOrderContactMessageDto,
  OrderStatusFilter,
  RiskLevelFilter,
} from './dto/admin-orders.dto';

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
    private readonly orderRiskService: OrderRiskService,
    private readonly orderReassignmentService: OrderReassignmentService,
    private readonly orderEventsService: OrderEventsService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    private readonly adminOrderContactService: AdminOrderContactService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all active orders with risk scores for admin dashboard' })
  @ApiResponse({
    status: 200,
    description: 'List of active orders with risk scores',
    schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: { type: 'object' },
        },
        total: { type: 'number' },
      },
    },
  })
  async getAdminOrders(@Query() query: GetAdminOrdersDto) {
    try {
      const {
        status = OrderStatusFilter.ALL,
        risk_level = RiskLevelFilter.ALL,
        search,
        offset = 0,
        limit = 50,
      } = query;

      const excludedStatuses = [
        'delivered',
        'complete',
        'cancelled',
        'failed',
        'refunded',
        'refund_processing',
        'refund_failed',
        'refund_requested',
        'refund_approved_full',
        'refund_approved_partial',
        'refund_rejected',
        'refund_approved_replace',
      ];

      let statusFilter: any = {
        _nin: excludedStatuses,
      };

      if (status !== OrderStatusFilter.ALL) {
        statusFilter = { _eq: status };
      }

      let whereClause: any = {
        current_status: statusFilter,
      };

      if (search) {
        whereClause = {
          ...whereClause,
          _or: [
            { order_number: { _ilike: `%${search}%` } },
            { client: { user: { first_name: { _ilike: `%${search}%` } } } },
            { client: { user: { last_name: { _ilike: `%${search}%` } } } },
          ],
        };
      }

      const ordersQuery = `
        query GetActiveOrders($where: orders_bool_exp!, $limit: Int!, $offset: Int!) {
          orders(
            where: $where
            order_by: { created_at: desc }
            limit: $limit
            offset: $offset
          ) {
            id
            order_number
            current_status
            created_at
            updated_at
            acceptance_deadline_at
            pickup_state
            pickup_due_at
            estimated_delivery_time
            total_amount
            currency
            fulfillment_method
            client {
              id
              user {
                id
                first_name
                last_name
                email
                phone_number
              }
            }
            business {
              id
              name
              user {
                email
                phone_number
              }
            }
            business_location {
              id
              name
              phone
              email
            }
            assigned_agent {
              id
              user {
                id
                first_name
                last_name
                email
                phone_number
              }
            }
            delivery_time_window {
              id
              time_slot_start
              time_slot_end
              preferred_date
            }
            delivery_address {
              id
              address_line_1
              city
              state
            }
          }
          orders_aggregate(where: $where) {
            aggregate {
              count
            }
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(ordersQuery, {
        where: whereClause,
        limit: Number(limit),
        offset: Number(offset),
      });

      const orders = result.orders || [];
      const total = result.orders_aggregate?.aggregate?.count || 0;

      const ordersWithRisk = orders.map((order: any) => {
        const enriched = this.orderRiskService.enrichOrderWithRisk(order);
        return {
          ...enriched,
          risk_level: this.orderRiskService.getRiskLevel(enriched.risk_score),
        };
      });

      let filteredOrders = ordersWithRisk;
      if (risk_level !== RiskLevelFilter.ALL) {
        filteredOrders = ordersWithRisk.filter(
          (order: any) => order.risk_level === risk_level
        );
      }

      filteredOrders.sort((a: any, b: any) => {
        if (b.risk_score !== a.risk_score) {
          return b.risk_score - a.risk_score;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return {
        orders: filteredOrders,
        total: risk_level === RiskLevelFilter.ALL ? total : filteredOrders.length,
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch admin orders', error);
      throw new HttpException(
        error.message || 'Failed to fetch orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':orderId/unassign-redispatch')
  @ApiOperation({ 
    summary: 'Unassign current agent and redispatch to nearby agents',
    description: 'Unassigns the current agent, releases their hold, and redispatches to nearby available agents. If no agents are available after exhausting dispatch rounds, the client will be notified with the option to switch to store pickup.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Order unassigned and redispatched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async unassignAndRedispatch(
    @Param('orderId') orderId: string,
    @Body() dto: UnassignRedispatchDto,
  ) {
    try {
      const order = await this.ordersService.getOrderById(orderId);
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      if (order.current_status !== 'assigned_to_agent') {
        throw new HttpException(
          'Order is not in assigned_to_agent status',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.orderReassignmentService.reassignOrder(
        orderId,
        dto.reason || 'Admin-initiated reassignment',
        { skipReliabilityPenalty: true },
      );

      if (!result.success) {
        throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
      }

      return result;
    } catch (error: any) {
      this.logger.error('Failed to unassign and redispatch', error);
      throw new HttpException(
        error.message || 'Failed to unassign and redispatch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':orderId/status')
  @ApiOperation({ summary: 'Override order status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  async updateStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    try {
      const order = await this.ordersService.getOrderById(orderId);
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      const updateMutation = `
        mutation UpdateOrderStatus($orderId: uuid!, $status: order_status_enum!, $notes: String) {
          update_orders_by_pk(
            pk_columns: { id: $orderId }
            _set: { current_status: $status }
          ) {
            id
            current_status
          }
          insert_order_status_history_one(
            object: {
              order_id: $orderId
              from_status: "${order.current_status}"
              to_status: $status
              notes: $notes
            }
          ) {
            id
          }
        }
      `;

      await this.hasuraSystemService.executeMutation(updateMutation, {
        orderId,
        status: dto.status,
        notes: dto.notes || 'Admin status override',
      });

      await this.orderEventsService.recordEvent({
        orderId,
        eventType: 'gps_unavailable',
        actorType: 'support',
        payload: {
          old_status: order.current_status,
          new_status: dto.status,
          notes: dto.notes,
        },
      });

      return {
        success: true,
        message: 'Status updated successfully',
      };
    } catch (error: any) {
      this.logger.error('Failed to update status', error);
      throw new HttpException(
        error.message || 'Failed to update status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':orderId/notes')
  @ApiOperation({ summary: 'Add admin note to order' })
  @ApiResponse({ status: 201, description: 'Note added successfully' })
  async addNote(
    @Param('orderId') orderId: string,
    @Body() dto: AddAdminNoteDto,
  ) {
    try {
      const order = await this.ordersService.getOrderById(orderId);
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      await this.orderEventsService.recordEvent({
        orderId,
        eventType: 'gps_unavailable',
        actorType: 'support',
        payload: {
          note: dto.note,
        },
      });

      return {
        success: true,
        message: 'Note added successfully',
      };
    } catch (error: any) {
      this.logger.error('Failed to add note', error);
      throw new HttpException(
        error.message || 'Failed to add note',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':orderId/contact/message')
  @ApiOperation({ summary: 'Send in-app message to order participant' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Missing message or recipient' })
  async sendMessage(
    @Param('orderId') orderId: string,
    @Body() body: SendOrderContactMessageDto,
  ) {
    const order = await this.ordersService.getOrderById(orderId);
    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    await this.adminOrderContactService.sendInAppMessage({
      order,
      message: body.message,
      recipientType: body.recipient_type,
    });

    return {
      success: true,
      message: 'Message sent successfully',
    };
  }

  @Post(':orderId/contact/email')
  @ApiOperation({ summary: 'Send email to order participant' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  async sendEmail(
    @Param('orderId') orderId: string,
    @Body() body: { subject: string; message: string; recipient_type: 'client' | 'business' | 'agent' },
  ) {
    try {
      const order = await this.ordersService.getOrderById(orderId);
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      let recipientEmail: string | undefined;
      if (body.recipient_type === 'client' && order.client?.user?.email) {
        recipientEmail = order.client.user.email;
      } else if (body.recipient_type === 'business' && order.business?.user?.email) {
        recipientEmail = order.business.user.email;
      } else if (body.recipient_type === 'agent' && order.assigned_agent?.user?.email) {
        recipientEmail = order.assigned_agent.user.email;
      }

      if (!recipientEmail) {
        throw new HttpException('Recipient email not found', HttpStatus.BAD_REQUEST);
      }

      await this.notificationsService.sendMerchantEngagementHtmlEmail({
        to: recipientEmail,
        subject: body.subject,
        html: body.message,
      });

      return {
        success: true,
        message: 'Email sent successfully',
      };
    } catch (error: any) {
      this.logger.error('Failed to send email', error);
      throw new HttpException(
        error.message || 'Failed to send email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':orderId/contact/sms')
  @ApiOperation({ summary: 'Send SMS to order participant' })
  @ApiResponse({ status: 200, description: 'SMS sent successfully' })
  async sendSms(
    @Param('orderId') orderId: string,
    @Body() body: { message: string; recipient_type: 'client' | 'business' | 'agent' },
  ) {
    try {
      const order = await this.ordersService.getOrderById(orderId);
      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      let recipientPhone: string | undefined;
      if (body.recipient_type === 'client' && order.client?.user?.phone_number) {
        recipientPhone = order.client.user.phone_number;
      } else if (body.recipient_type === 'business' && order.business?.user?.phone_number) {
        recipientPhone = order.business.user.phone_number;
      } else if (body.recipient_type === 'agent' && order.assigned_agent?.user?.phone_number) {
        recipientPhone = order.assigned_agent.user.phone_number;
      }

      if (!recipientPhone) {
        throw new HttpException('Recipient phone not found', HttpStatus.BAD_REQUEST);
      }

      await this.notificationsService.sendInternalSms(
        recipientPhone,
        body.message,
      );

      return {
        success: true,
        message: 'SMS sent successfully',
      };
    } catch (error: any) {
      this.logger.error('Failed to send SMS', error);
      throw new HttpException(
        error.message || 'Failed to send SMS',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
