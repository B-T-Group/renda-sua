import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommerceIntegrationsDatabaseService } from './commerce-integrations-database.service';
import { CommerceQueueService } from './commerce-queue.service';

/**
 * Singleton cron host for commerce inventory reconciliation.
 * Must not inject request-scoped providers (e.g. HasuraUserService /
 * BusinessItemsAccessService) or NestJS will skip @Cron registration.
 */
@Injectable()
export class CommerceInventorySyncCronService {
  private readonly logger = new Logger(CommerceInventorySyncCronService.name);

  constructor(
    private readonly db: CommerceIntegrationsDatabaseService,
    private readonly queue: CommerceQueueService
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledReconciliation(): Promise<void> {
    try {
      const n = await this.enqueueShardedReconciles();
      if (n > 0) {
        this.logger.log(`Queued ${n} commerce inventory reconcile(s)`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  private async enqueueShardedReconciles(): Promise<number> {
    const integrations = await this.db.listConnectedIntegrations();
    const shardSlot = Math.floor(Date.now() / 1800000) % 2;
    let queued = 0;
    for (const integration of integrations) {
      const shard = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16);
      if (Number.isNaN(shard) || shard % 2 !== shardSlot) continue;
      await this.queue.enqueue({
        type: 'reconcile',
        integrationId: integration.id,
        trigger: 'RECONCILIATION',
      });
      queued += 1;
    }
    return queued;
  }
}
