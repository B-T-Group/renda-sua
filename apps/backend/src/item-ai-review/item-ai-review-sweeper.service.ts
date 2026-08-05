import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as Q from './item-ai-review.queries';

/**
 * Well above Lambda timeout (15m) + SQS visibility (16m). Resume-after-cleanup
 * touches items.updated_at so legitimate long cleanup waits are not swept.
 * SQS retries do not refresh updated_at, so orphaned claims still get reset.
 */
const STALE_MINUTES = 120;
const SWEEP_BATCH = 50;
const SWEEP_REASON = `Stuck in ai_reviewing for over ${STALE_MINUTES} minutes; reset to pending for manual review`;

type StaleItemRow = {
  id: string;
  name: string;
  updated_at: string;
};

@Injectable()
export class ItemAiReviewSweeperService {
  private readonly logger = new Logger(ItemAiReviewSweeperService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepStuckAiReviewing(): Promise<void> {
    try {
      const items = await this.fetchStaleItems();
      if (!items.length) return;
      const openCleanupIds = await this.fetchOpenCleanupItemIds(
        items.map((i) => i.id)
      );
      for (const item of items) {
        if (openCleanupIds.has(item.id)) continue;
        await this.resetStaleItem(item);
      }
    } catch (error: any) {
      this.logger.error(
        `AI reviewing sweeper failed: ${error?.message ?? error}`
      );
    }
  }

  private async fetchStaleItems(): Promise<StaleItemRow[]> {
    const staleBefore = new Date(
      Date.now() - STALE_MINUTES * 60 * 1000
    ).toISOString();
    const result = await this.hasura.executeQuery<{
      items: StaleItemRow[];
    }>(Q.STALE_AI_REVIEWING_ITEMS, { staleBefore, limit: SWEEP_BATCH });
    return result.items ?? [];
  }

  private async fetchOpenCleanupItemIds(
    itemIds: string[]
  ): Promise<Set<string>> {
    const result = await this.hasura.executeQuery<{
      ai_image_cleanup_jobs: Array<{ item_id: string }>;
    }>(Q.OPEN_CLEANUP_JOBS_FOR_ITEMS, { itemIds });
    return new Set(
      (result.ai_image_cleanup_jobs ?? []).map((j) => j.item_id)
    );
  }

  private async resetStaleItem(item: StaleItemRow): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.FAIL_RUNNING_AI_REVIEWS_FOR_ITEM, {
      itemId: item.id,
      decisionReason: SWEEP_REASON,
      completedAt: now,
    });
    const result = await this.hasura.executeMutation<{
      update_items: { affected_rows: number };
    }>(Q.RESET_ITEM_PENDING_IF_AI_REVIEWING, { id: item.id });
    if ((result.update_items?.affected_rows ?? 0) === 0) return;
    this.logger.warn(`Swept stuck ai_reviewing item ${item.id} to pending`);
    await this.notifications.notifySuperusersItemAiReviewFailed({
      itemId: item.id,
      itemName: item.name || item.id,
      reason: SWEEP_REASON,
    });
  }
}
