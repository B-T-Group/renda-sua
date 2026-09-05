import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorePickupReminderService } from './store-pickup-reminder.service';

@Injectable()
export class StorePickupReminderCronService {
  private readonly logger = new Logger(StorePickupReminderCronService.name);

  constructor(
    private readonly storePickupReminderService: StorePickupReminderService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyStorePickupReminders(): Promise<void> {
    try {
      const result = await this.storePickupReminderService.runHourlyReminders();
      if (!result.skipped && result.sent > 0) {
        this.logger.log(`Store pickup reminder cron sent=${result.sent}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Store pickup reminder cron failed: ${error?.message ?? String(error)}`
      );
    }
  }
}
