import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { PendingWithdrawalResolveService } from './pending-withdrawal-resolve.service';

const BATCH_LIMIT = 100;
const NULL_PROVIDER_ID_GRACE_HOURS = 24;

@Injectable()
export class PendingWithdrawalReconcilerService {
  private readonly logger = new Logger(PendingWithdrawalReconcilerService.name);

  constructor(
    private readonly databaseService: MobilePaymentsDatabaseService,
    private readonly resolveService: PendingWithdrawalResolveService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reconcilePendingWithdrawals(): Promise<void> {
    const items =
      await this.databaseService.getPendingGiveChangeWithdrawals({
        limit: BATCH_LIMIT,
      });

    const counts = {
      paid: 0,
      failed: 0,
      cancelled: 0,
      still_pending: 0,
      errors: 0,
    };

    this.logger.log(
      `Pending withdrawal reconciler starting (${items.length} rows)`
    );

    for (const tx of items) {
      try {
        const result = await this.resolveService.resolveAsSystem(tx.id, {
          allowImmediateCancel: false,
          minAgeHours: NULL_PROVIDER_ID_GRACE_HOURS,
        });
        counts[result.outcome] += 1;
      } catch (error: any) {
        counts.errors += 1;
        this.logger.warn(
          `Failed to reconcile pending withdrawal ${tx.id}: ${
            error?.message || error
          }`
        );
      }
    }

    this.logger.log(
      `Pending withdrawal reconciler finished: ${JSON.stringify(counts)}`
    );
  }
}
