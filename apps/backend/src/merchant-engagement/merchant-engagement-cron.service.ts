import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MerchantEngagementService } from './merchant-engagement.service';

/**
 * Singleton cron host — must not inject request-scoped providers.
 */
@Injectable()
export class MerchantEngagementCronService {
  private readonly logger = new Logger(MerchantEngagementCronService.name);

  constructor(private readonly engagement: MerchantEngagementService) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async handleDailyPushes(): Promise<void> {
    try {
      const n = await this.engagement.runDailyEngagementPushes();
      if (n > 0) this.logger.log(`Sent ${n} merchant engagement push(es)`);
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_11AM)
  async handlePaymentSetupNudges(): Promise<void> {
    try {
      const n = await this.engagement.runPaymentSetupNudges();
      if (n > 0) this.logger.log(`Sent ${n} payment-setup nudge(s)`);
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleWeeklyDigestWindow(): Promise<void> {
    if (new Date().getDay() !== 1) return; // Monday in server-local time (matches cron TZ)
    try {
      const n = await this.engagement.runWeeklyDigests();
      if (n > 0) this.logger.log(`Sent ${n} merchant weekly digest(s)`);
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }
}
