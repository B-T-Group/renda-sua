import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import type { Configuration } from '../config/configuration';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderOffersService } from './order-offers.service';
import { OrderStatusService } from './order-status.service';

@ApiTags('Notifications')
@Controller('notifications')
export class OrderNotificationsInternalController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly orderStatusService: OrderStatusService,
    private readonly orderOffersService: OrderOffersService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Public()
  @Post('internal/order-status-change')
  @ApiOperation({
    summary:
      'Internal: send order status change notifications (order-status-handler Lambda)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'previousStatus'],
      properties: {
        orderId: { type: 'string', format: 'uuid' },
        previousStatus: { type: 'string' },
        actorUserId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional users.id of the actor; excluded from recipient list',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Notification attempt finished' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async internalOrderStatusChange(
    @Body()
    body: {
      orderId?: string;
      previousStatus?: string;
      actorUserId?: string | null;
    },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
    const orderId = body?.orderId?.trim();
    const previousStatus = body?.previousStatus?.trim();
    if (!orderId || !previousStatus) {
      return { success: false, error: 'orderId and previousStatus are required' };
    }
    const notificationsEnabled =
      this.configService.get('notification').orderStatusChangeEnabled;
    if (!notificationsEnabled) {
      return { success: true, skipped: true };
    }
    try {
      const orderDetails =
        await this.orderStatusService.getOrderDetailsForNotification(orderId);
      if (!orderDetails) {
        return {
          success: false,
          error: 'Order not found or notification payload unavailable',
        };
      }
      await this.notificationsService.sendOrderStatusChangeNotifications(
        orderDetails,
        previousStatus,
        { actorUserId: body.actorUserId }
      );

      // When an order becomes claimable, fan out a high-priority delivery
      // offer to the closest eligible agents (fire-and-forget; idempotent).
      if (orderDetails.orderStatus === 'ready_for_pickup') {
        void this.orderOffersService.dispatchOrderOffers(orderId);
      }

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
