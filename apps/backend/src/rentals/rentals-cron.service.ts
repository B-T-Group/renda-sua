import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RentalsService } from './rentals.service';

@Injectable()
export class RentalsCronService {
  private readonly logger = new Logger(RentalsCronService.name);

  constructor(private readonly rentalsService: RentalsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleRentalPeriodEnd(): Promise<void> {
    try {
      const n = await this.rentalsService.processEndedActiveBookings();
      if (n > 0) {
        this.logger.log(`Processed ${n} rental period end(s)`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }
}
