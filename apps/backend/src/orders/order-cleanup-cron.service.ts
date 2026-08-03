import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderCleanupService } from './order-cleanup.service';

/**
 * Singleton cron host for daily stale-order cleanup.
 * Must not inject request-scoped providers.
 */
@Injectable()
export class OrderCleanupCronService {
  private readonly logger = new Logger(OrderCleanupCronService.name);

  constructor(private readonly orderCleanupService: OrderCleanupService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyOrderCleanup(): Promise<void> {
    try {
      const result = await this.orderCleanupService.runDailyCleanup();
      if (!result.skipped) {
        this.logger.log(
          `Daily cleanup done: pending=${result.pendingPaymentCancelled}, ready=${result.readyForPickupCancelled}, failed=${result.midFulfillmentFailed}`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Daily order cleanup failed: ${error?.message ?? String(error)}`
      );
    }
  }
}
