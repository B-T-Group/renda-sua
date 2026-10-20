import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DedicatedPostingsService } from './dedicated-postings.service';

/**
 * #594 PR 7 (AC-B13): expire open postings after `dedicated_posting_expiry_days`
 * (expires_at, 14 days by default) and auto-decline their pending applicants.
 * Same shape as UnpaidPayAfterSweeperService: in-process re-entry guard; the
 * writes are guarded on status 'open', so overlapping instances are harmless.
 */
@Injectable()
export class DedicatedPostingsSweeperService {
  private readonly logger = new Logger(DedicatedPostingsSweeperService.name);
  private running = false;

  constructor(private readonly postings: DedicatedPostingsService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.postings.expireDue();
      if (result.found > 0) {
        this.logger.log(JSON.stringify({ event: 'dedicated.postings_expiry_sweep', ...result }));
      }
    } catch (error) {
      this.logger.error(`Dedicated posting expiry sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
