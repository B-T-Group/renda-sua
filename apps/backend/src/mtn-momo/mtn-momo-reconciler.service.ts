import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MtnMomoService } from './mtn-momo.service';

/**
 * Polling fallback for MTN MoMo request-to-pay. MTN calls the webhook once and
 * never retries, so a missed or rejected callback would leave the payment request
 * PENDING forever. Each run re-reads MTN's status for PENDING requests older than a
 * minute. Idempotent and safe across instances: only a PENDING row can move.
 */
@Injectable()
export class MtnMomoReconcilerService {
  private readonly logger = new Logger(MtnMomoReconcilerService.name);
  private running = false;

  constructor(private readonly mtnMomoService: MtnMomoService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePendingPaymentRequests(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.mtnMomoService.reconcilePendingPaymentRequests({
        minAgeSeconds: 60,
        limit: 50,
      });
      if (result.checked > 0) {
        this.logger.log(
          `MTN MoMo pending reconciler: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logger.warn(
        `MTN MoMo pending reconciler failed: ${(error as Error).message}`
      );
    } finally {
      this.running = false;
    }
  }
}
