import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LaunchPromoService } from './launch-promo.service';

/** Singleton cron host — must not inject request-scoped providers. */
@Injectable()
export class LaunchPromoCronService {
  private readonly logger = new Logger(LaunchPromoCronService.name);

  constructor(private readonly launchPromoService: LaunchPromoService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleReleaseExpiredSlots(): Promise<void> {
    try {
      const { released } =
        await this.launchPromoService.releaseExpiredSlots();
      if (released > 0) {
        this.logger.log(`Released ${released} expired launch promo slot(s)`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }
}
