import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';

const PURGE = `
  mutation PurgeAssistantRentalZeroResults($now: timestamptz!) {
    delete_assistant_rental_zero_results(where: { expires_at: { _lt: $now } }) { affected_rows }
  }
`;

@Injectable()
export class AssistantRentalCronService {
  private readonly logger = new Logger(AssistantRentalCronService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredZeroResults(): Promise<void> {
    try {
      const res = await this.hasura.executeQuery<{ delete_assistant_rental_zero_results: { affected_rows: number } }>(
        PURGE,
        { now: new Date().toISOString() }
      );
      const rows = res.delete_assistant_rental_zero_results?.affected_rows ?? 0;
      if (rows > 0) this.logger.log(`Purged ${rows} expired rental zero-result rows`);
    } catch (error: any) {
      this.logger.warn(`Rental zero-result purge failed: ${error?.message ?? error}`);
    }
  }
}
