import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdDocumentAiReviewService } from './id-document-ai-review.service';

@Injectable()
export class IdDocumentAiReviewSweeperService {
  private readonly logger = new Logger(IdDocumentAiReviewSweeperService.name);
  private running = false;

  constructor(private readonly reviewService: IdDocumentAiReviewService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepPendingIdDocuments(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.reviewService.processPendingBatch();
    } catch (error: any) {
      this.logger.error(
        `ID document AI sweeper failed: ${error?.message ?? error}`
      );
    } finally {
      this.running = false;
    }
  }
}
