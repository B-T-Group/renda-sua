import {
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
