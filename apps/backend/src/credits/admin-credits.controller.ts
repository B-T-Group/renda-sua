import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
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
import { HasuraUserService } from '../hasura/hasura-user.service';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { CreditsQueuesService } from './credits-queues.service';
import { CreditsService } from './credits.service';
import {
  AdminCreditsListQueryDto,
  AdminCreditsQueueQueryDto,
  AdminCreditsSummaryQueryDto,
  OrderFeedbackCreditDto,
  ResolveEscalationCreditDto,
} from './dto/admin-credits.dto';

@ApiTags('admin/credits')
@Controller('admin/credits')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
@RequirePermissions(PlatformPermissions.OPS_CREDITS)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminCreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly queuesService: CreditsQueuesService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Credit leaderboard (weighted totals)' })
  @ApiResponse({ status: 200, description: 'Leaderboard rows' })
  async summary(@Query() query: AdminCreditsSummaryQueryDto) {
    return this.queuesService.listSummary({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      eventType: query.eventType,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Credit ledger (paginated)' })
  @ApiResponse({ status: 200, description: 'Credit rows' })
  async list(@Query() query: AdminCreditsListQueryDto) {
    return this.queuesService.listCredits({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      userId: query.userId,
      eventType: query.eventType,
    });
  }

  @Get('queues/escalations')
  @ApiOperation({ summary: 'Open order risk incidents' })
  async escalationsQueue(@Query() query: AdminCreditsQueueQueryDto) {
    return this.queuesService.listOpenEscalations({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  @Get('queues/cancelled')
  @ApiOperation({
    summary: 'Cancelled orders in the last 14 days without feedback credit',
  })
  async cancelledQueue(@Query() query: AdminCreditsQueueQueryDto) {
    return this.queuesService.listCancelledWithoutFeedback({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  @Get('queues/first-order')
  @ApiOperation({
    summary: 'First completed orders in the last 14 days without feedback',
  })
  async firstOrderQueue(@Query() query: AdminCreditsQueueQueryDto) {
    return this.queuesService.listFirstOrderWithoutFeedback({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  @Post('escalations/:incidentId/resolve')
  @ApiOperation({
    summary: 'Record escalation resolution and award credit',
  })
  @ApiParam({ name: 'incidentId' })
  async resolveEscalation(
    @Param('incidentId') incidentId: string,
    @Body() dto: ResolveEscalationCreditDto
  ) {
    const actor = await this.hasuraUserService.getUser();
    const incident = await this.creditsService.resolveIncidentForCredit({
      incidentId,
      userId: actor.id,
      note: dto.notes,
      contactChannel: dto.contact_channel,
      orderResult: dto.order_result,
    });
    if (!incident) throw new NotFoundException('Incident not found');
    const credit = await this.creditsService.awardEscalationResolved({
      userId: actor.id,
      incidentId: incident.id,
      orderId: incident.order_id,
      contactChannel: dto.contact_channel,
      orderResult: dto.order_result,
      notes: dto.notes,
    });
    return { success: true, incident, credit };
  }

  @Post('orders/:orderId/cancelled-feedback')
  @ApiOperation({ summary: 'Record cancelled-order call-back feedback' })
  @ApiParam({ name: 'orderId' })
  async cancelledFeedback(
    @Param('orderId') orderId: string,
    @Body() dto: OrderFeedbackCreditDto
  ) {
    const actor = await this.hasuraUserService.getUser();
    const order = await this.requireOrderInWindow(orderId, 'cancelled');
    const credit = await this.creditsService.awardCancelledFeedback({
      userId: actor.id,
      orderId: order.id,
      notes: dto.notes,
    });
    if (!credit) {
      throw new HttpException(
        'Feedback already recorded for this order',
        HttpStatus.CONFLICT
      );
    }
    return { success: true, credit };
  }

  @Post('orders/:orderId/first-order-feedback')
  @ApiOperation({ summary: 'Record first-order call-back feedback' })
  @ApiParam({ name: 'orderId' })
  async firstOrderFeedback(
    @Param('orderId') orderId: string,
    @Body() dto: OrderFeedbackCreditDto
  ) {
    const actor = await this.hasuraUserService.getUser();
    const order = await this.requireOrderInWindow(orderId, 'complete');
    const isFirst = await this.queuesService.isClientFirstCompletedOrder(
      order.client_id,
      order.id
    );
    if (!isFirst) {
      throw new BadRequestException('Order is not the client first completion');
    }
    const credit = await this.creditsService.awardFirstOrderFeedback({
      userId: actor.id,
      orderId: order.id,
      notes: dto.notes,
    });
    if (!credit) {
      throw new HttpException(
        'Feedback already recorded for this order',
        HttpStatus.CONFLICT
      );
    }
    return { success: true, credit };
  }

  private async requireOrderInWindow(
    orderId: string,
    status: 'cancelled' | 'complete'
  ) {
    const order = await this.queuesService.getOrderForFeedback(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.current_status !== status) {
      throw new BadRequestException(`Order is not ${status}`);
    }
    const stamp =
      status === 'cancelled' ? order.cancelled_at : order.completed_at;
    const ok = await this.queuesService.isWithinFeedbackWindow(stamp);
    if (!ok) {
      throw new BadRequestException(
        'Order is outside the 14-day feedback window'
      );
    }
    return order;
  }
}
