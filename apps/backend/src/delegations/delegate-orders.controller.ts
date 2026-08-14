import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DelegationGuard } from './delegation.guard';
import { RequireDelegationPermissions } from './require-delegation-permissions.decorator';
import { DELEGATION_PERMISSIONS } from './delegation.constants';
import { DelegateOrdersService } from './delegate-orders.service';
import type { DelegationAccessContext } from './delegation.types';
import type {
  BatchOrderStatusChangeRequest,
  ConfirmOrderRequest,
  OrderStatusChangeRequest,
} from '../orders/orders.service';
import type { ResolutionRequest } from '../orders/failed-deliveries.service';

@ApiTags('delegate')
@Controller('delegate')
@UseGuards(DelegationGuard)
@ApiBearerAuth()
export class DelegateOrdersController {
  constructor(private readonly service: DelegateOrdersService) {}

  @Get('actions-needed')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'Pending orders at the active delegation location' })
  async actionsNeeded(@Req() req: { delegation: DelegationAccessContext }) {
    return { success: true, ...(await this.service.actionsNeeded(req.delegation)) };
  }

  @Get('failed-deliveries')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Failed deliveries at the active location' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'resolution_type', required: false })
  async failedDeliveries(
    @Req() req: { delegation: DelegationAccessContext },
    @Query('status') status?: 'pending' | 'completed',
    @Query('resolution_type') resolution_type?: string
  ) {
    const failed_deliveries = await this.service.listFailedDeliveries(
      req.delegation,
      { status, resolution_type }
    );
    return { success: true, failed_deliveries };
  }

  @Post('failed-deliveries/:orderId/resolve')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Resolve a failed delivery at this location' })
  @ApiParam({ name: 'orderId' })
  async resolveFailed(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('orderId') orderId: string,
    @Body() body: ResolutionRequest
  ) {
    return this.service.resolveFailedDelivery(req.delegation, orderId, body);
  }

  @Get('orders')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'List orders for the active delegation location' })
  @ApiQuery({ name: 'filters', required: false })
  async list(
    @Req() req: { delegation: DelegationAccessContext },
    @Query('filters') filters?: string
  ) {
    const parsed = this.parseFilters(filters);
    return { success: true, orders: await this.service.list(req.delegation, parsed) };
  }

  @Get('orders/:id/cancellation-preview')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Cancellation preview for a location order' })
  async cancellationPreview(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('id') id: string
  ) {
    return this.service.cancellationPreview(req.delegation, id);
  }

  @Get('orders/:id/events')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'Order events at this location' })
  async events(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('id') id: string
  ) {
    return this.service.events(req.delegation, id);
  }

  @Get('orders/:orderId/messages')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'Order messages at this location' })
  async messages(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('orderId') orderId: string
  ) {
    return { success: true, messages: await this.service.messages(req.delegation, orderId) };
  }

  @Post('orders/:orderId/messages')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Post an order message as a location delegate' })
  async createMessage(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('orderId') orderId: string,
    @Body() body: { message: string; mentionedUserId?: string }
  ) {
    return {
      success: true,
      message: await this.service.createMessage(
        req.delegation,
        orderId,
        body.message,
        body.mentionedUserId
      ),
    };
  }

  @Get('orders/:orderId/mentionable-participants')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_READ)
  async mentionable(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('orderId') orderId: string
  ) {
    return {
      success: true,
      participants: await this.service.mentionable(req.delegation, orderId),
    };
  }

  @Get('orders/:orderId/messages/quick-templates')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async quickTemplates(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('orderId') orderId: string
  ) {
    return {
      success: true,
      templates: await this.service.quickTemplates(req.delegation, orderId),
    };
  }

  @Post('orders/:orderId/messages/quick')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async sendQuick(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('orderId') orderId: string,
    @Body() body: { templateId: string }
  ) {
    return {
      success: true,
      message: await this.service.sendQuick(
        req.delegation,
        orderId,
        body.templateId
      ),
    };
  }

  @Get('orders/:orderId/messages/active-delivery-pin')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async activePin(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('orderId') orderId: string
  ) {
    return {
      success: true,
      pin: await this.service.activeDeliveryPin(req.delegation, orderId),
    };
  }

  @Get('orders/:id')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_READ)
  @ApiOperation({ summary: 'Order detail at this location' })
  async detail(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('id') id: string
  ) {
    return { success: true, order: await this.service.getById(req.delegation, id) };
  }

  @Post('orders/confirm')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Confirm a location order' })
  async confirm(
    @Req() req: { delegation: DelegationAccessContext },
    @Body() body: ConfirmOrderRequest
  ) {
    return this.service.confirm(req.delegation, body);
  }

  @Post('orders/complete_preparation')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async completePreparation(
    @Req() req: { delegation: DelegationAccessContext },
    @Body() body: OrderStatusChangeRequest
  ) {
    return this.service.completePreparation(req.delegation, body);
  }

  @Post('orders/batch/complete_preparation')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async completePreparationBatch(
    @Req() req: { delegation: DelegationAccessContext },
    @Body() body: BatchOrderStatusChangeRequest
  ) {
    return this.service.completePreparationBatch(req.delegation, body);
  }

  @Post('orders/cancel')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async cancel(
    @Req() req: { delegation: DelegationAccessContext },
    @Body() body: OrderStatusChangeRequest
  ) {
    return this.service.cancel(req.delegation, body);
  }

  @Patch('orders/:id/status')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  @ApiBody({ schema: { properties: { status: { type: 'string' } } } })
  async updateStatus(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('id') id: string,
    @Body() body: { status: string }
  ) {
    return this.service.updateStatus(req.delegation, id, body.status);
  }

  @Post('orders/:id/confirm-pickup')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async confirmPickup(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('id') id: string,
    @Body()
    body: { pin?: string; useLatestSharedPin?: boolean; pinMessageId?: string }
  ) {
    return this.service.confirmPickup(req.delegation, id, body);
  }

  @Post('orders/:id/pickup-not-ready')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async pickupNotReady(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('id') id: string,
    @Body() body?: { extraMinutes?: number }
  ) {
    return this.service.pickupNotReady(req.delegation, id, body?.extraMinutes);
  }

  @Post('orders/:id/pickup-resume')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  async pickupResume(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('id') id: string
  ) {
    return this.service.pickupResume(req.delegation, id);
  }

  @Post('orders/:id/initiate-pay-at-pickup-payment')
  @RequireDelegationPermissions(DELEGATION_PERMISSIONS.ORDERS_MANAGE)
  @ApiResponse({ status: 200, description: 'Payment request initiated' })
  async payAtPickup(
    @Req() req: { delegation: DelegationAccessContext },
    @Param('id') id: string,
    @Body() body?: { phone_number?: string }
  ) {
    return this.service.initiatePayAtPickup(
      req.delegation,
      id,
      body?.phone_number
    );
  }

  private parseFilters(filters?: string): unknown {
    if (!filters) return undefined;
    try {
      return JSON.parse(filters);
    } catch {
      return undefined;
    }
  }
}
