import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
import {
  FEEDBACK_ACTION_TO_CHANNEL,
  FEEDBACK_ACTION_TO_CLASSIFICATION,
  type CreditContactChannel,
  type CreditFeedbackAction,
} from './credit.types';
import { CreditsQueuesService } from './credits-queues.service';
import { CreditsService } from './credits.service';
import {
  AdminCreditsListQueryDto,
  AdminCreditsQueueQueryDto,
  AdminCreditsSummaryQueryDto,
  OrderFeedbackCreditDto,
  ResolveEscalationCreditDto,
} from './dto/admin-credits.dto';

type FeedbackOrder = {
  id: string;
  client_id: string;
  client_user_id: string | null;
};

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
      country: query.country,
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
      country: query.country,
    });
  }

  @Get('queues/escalations')
  @ApiOperation({ summary: 'Open order risk incidents' })
  async escalationsQueue(@Query() query: AdminCreditsQueueQueryDto) {
    return this.queuesService.listOpenEscalations({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      country: query.country,
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
      country: query.country,
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
      country: query.country,
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
    return this.handleOrderFeedback(orderId, dto, 'cancelled');
  }

  @Post('orders/:orderId/first-order-feedback')
  @ApiOperation({ summary: 'Record first-order call-back feedback' })
  @ApiParam({ name: 'orderId' })
  async firstOrderFeedback(
    @Param('orderId') orderId: string,
    @Body() dto: OrderFeedbackCreditDto
  ) {
    return this.handleOrderFeedback(orderId, dto, 'complete');
  }

  private async handleOrderFeedback(
    orderId: string,
    dto: OrderFeedbackCreditDto,
    status: 'cancelled' | 'complete'
  ) {
    const actor = await this.hasuraUserService.getUser();
    const order = await this.requireOrderInWindow(orderId, status);
    if (status === 'complete') await this.requireFirstCompletion(order);
    const classification = FEEDBACK_ACTION_TO_CLASSIFICATION[dto.action];
    if (classification) {
      return this.classifyWithoutCredit(actor.id, order.id, dto, classification);
    }
    return this.awardOrderFeedback(actor.id, order, dto, status);
  }

  private async requireFirstCompletion(order: FeedbackOrder) {
    const isFirst = await this.queuesService.isClientFirstCompletedOrder(
      order.client_id,
      order.id
    );
    if (!isFirst) {
      throw new BadRequestException('Order is not the client first completion');
    }
  }

  private async classifyWithoutCredit(
    actorId: string,
    orderId: string,
    dto: OrderFeedbackCreditDto,
    classification: 'test' | 'internal'
  ) {
    const ok = await this.creditsService.classifyOrderForOps({
      orderId,
      classification,
      actorId,
      notes: dto.notes,
    });
    if (!ok) {
      throw new HttpException(
        'Order already classified or feedback recorded',
        HttpStatus.CONFLICT
      );
    }
    return { success: true, credit: null, classification };
  }

  private async awardOrderFeedback(
    actorId: string,
    order: FeedbackOrder,
    dto: OrderFeedbackCreditDto,
    status: 'cancelled' | 'complete'
  ) {
    this.assertNotSelfAward(actorId, order.client_user_id);
    const channel = this.requireChannel(dto.action);
    const credit = await this.insertFeedbackCredit(
      actorId,
      order.id,
      dto.notes,
      channel,
      status
    );
    if (!credit) {
      throw new HttpException(
        'Feedback already recorded for this order',
        HttpStatus.CONFLICT
      );
    }
    return { success: true, credit };
  }

  private requireChannel(action: CreditFeedbackAction): CreditContactChannel {
    const channel = FEEDBACK_ACTION_TO_CHANNEL[action];
    if (!channel) throw new BadRequestException('Invalid feedback action');
    return channel;
  }

  private async insertFeedbackCredit(
    actorId: string,
    orderId: string,
    notes: string,
    channel: CreditContactChannel,
    status: 'cancelled' | 'complete'
  ) {
    const params = {
      userId: actorId,
      orderId,
      notes,
      contactChannel: channel,
    };
    if (status === 'cancelled') {
      return this.creditsService.awardCancelledFeedback(params);
    }
    return this.creditsService.awardFirstOrderFeedback(params);
  }

  private assertNotSelfAward(
    actorId: string,
    clientUserId: string | null
  ): void {
    if (clientUserId && actorId === clientUserId) {
      throw new ForbiddenException(
        'You cannot award feedback credit on your own order'
      );
    }
  }

  private async requireOrderInWindow(
    orderId: string,
    status: 'cancelled' | 'complete'
  ): Promise<FeedbackOrder> {
    const order = await this.queuesService.getOrderForFeedback(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.ops_classification) {
      throw new HttpException(
        'Order already classified as test or internal',
        HttpStatus.CONFLICT
      );
    }
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
    return {
      id: order.id,
      client_id: order.client_id,
      client_user_id: order.client_user_id,
    };
  }
}
