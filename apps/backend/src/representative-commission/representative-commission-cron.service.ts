import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RepresentativeCommissionService } from './representative-commission.service';

/** 06:00 UTC on the 10th is 07:00 in Africa/Douala. */
@Injectable()
export class RepresentativeCommissionCronService {
  private readonly logger = new Logger(RepresentativeCommissionCronService.name);

  constructor(private readonly commissions: RepresentativeCommissionService) {}

  @Cron('0 6 10 * *')
  async closePreviousMonth(): Promise<void> {
    await this.run('close', () => this.commissions.closePreviousMonth());
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async releaseDueHolds(): Promise<void> {
    await this.run('release', () => this.commissions.releaseDueHolds());
  }

  private async run(label: string, work: () => Promise<number>): Promise<void> {
    try {
      const count = await work();
      if (count > 0) this.logger.log(`Portfolio ${label}: ${count}`);
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }
}
