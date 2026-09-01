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
import { OrderCleanupService } from './order-cleanup.service';

@ApiTags('Orders')
@Controller('orders')
export class OrderCleanupInternalController {
  constructor(
    private readonly orderCleanupService: OrderCleanupService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  private assertInternalKey(internalKey?: string): void {
    const expected =
      this.configService.get<Configuration['notificationsInternal']>(
        'notificationsInternal'
      )?.apiKey ?? '';
    if (!expected || internalKey !== expected) {
      throw new UnauthorizedException();
    }
  }

  @Public()
  @Post('internal/cancel-unpaid')
  @ApiOperation({
    summary:
      'Internal: CAS-cancel pending_payment order (payment timeout / failed grace)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'string', format: 'uuid' },
        reason: {
          type: 'string',
          enum: ['timeout', 'payment_failed_grace'],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cancel attempted' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async cancelUnpaid(
    @Body() body: { orderId?: string; reason?: 'timeout' | 'payment_failed_grace' },
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{
    success: boolean;
    cancelled: boolean;
    skipped?: boolean;
    reason?: string;
  }> {
    this.assertInternalKey(internalKey);
    const orderId = body?.orderId?.trim();
    if (!orderId) {
      return {
        success: false,
        cancelled: false,
        reason: 'orderId is required',
      };
    }
    const reason = body?.reason ?? 'timeout';
    const notes =
      reason === 'payment_failed_grace'
        ? 'Order cancelled due to payment failure (grace period elapsed)'
        : 'Order cancelled due to payment timeout';
    const result = await this.orderCleanupService.cancelUnpaidPendingPaymentAsSystem(
      orderId,
      notes,
      { reason }
    );
    return { success: true, ...result };
  }

  @Public()
  @Post('internal/cleanup-stale')
  @ApiOperation({
    summary: 'Internal: run daily stale-order cleanup once (manual / ops)',
  })
  @ApiResponse({ status: 200, description: 'Cleanup finished' })
  @ApiResponse({ status: 401, description: 'Invalid or missing internal key' })
  async cleanupStale(
    @Headers('x-rendasua-internal-key') internalKey?: string
  ): Promise<{
    success: boolean;
    skipped?: boolean;
    pendingPaymentCancelled: number;
    readyForPickupCancelled: number;
    midFulfillmentFailed: number;
  }> {
    this.assertInternalKey(internalKey);
    const result = await this.orderCleanupService.runDailyCleanup();
    return { success: true, ...result };
  }
}
