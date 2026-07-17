import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';

interface NudgeCandidateOrder {
  id: string;
  order_number: string;
  client?: {
    user_id: string;
    user?: { preferred_language?: string | null } | null;
  } | null;
  order_items?: Array<{ item_id: string }>;
  ratings?: Array<{ rated_entity_id: string }>;
}

const LIST_ORDERS_NEEDING_ITEM_RATING_NUDGE = `
  query OrdersNeedingItemRatingNudge($cutoff: timestamptz!, $limit: Int!) {
    orders(
      where: {
        current_status: { _eq: "complete" }
        completed_at: { _lte: $cutoff }
        item_rating_nudge_sent_at: { _is_null: true }
      }
      order_by: { completed_at: asc }
      limit: $limit
    ) {
      id
      order_number
      client {
        user_id
        user {
          preferred_language
        }
      }
      order_items {
        item_id
      }
      ratings(where: { rating_type: { _eq: client_to_item } }) {
        rated_entity_id
      }
    }
  }
`;

const MARK_ITEM_RATING_NUDGE_SENT = `
  mutation MarkItemRatingNudgeSent($orderId: uuid!, $at: timestamptz!) {
    update_orders_by_pk(
      pk_columns: { id: $orderId }
      _set: { item_rating_nudge_sent_at: $at }
    ) {
      id
    }
  }
`;

/**
 * Singleton cron host for rating prompt jobs.
 * Must not inject request-scoped providers (e.g. HasuraUserService).
 */
@Injectable()
export class RatingsCronService {
  private readonly logger = new Logger(RatingsCronService.name);
  private static readonly BATCH_LIMIT = 200;

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleItemRatingNudges(): Promise<void> {
    try {
      const n = await this.sendPendingItemRatingNudges();
      if (n > 0) {
        this.logger.log(`Sent ${n} item rating nudge(s)`);
      }
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  /** Nudge clients to rate items on orders completed more than the configured delay ago. */
  async sendPendingItemRatingNudges(): Promise<number> {
    const delayDays =
      this.configService.get<Configuration['rating']>('rating')
        ?.itemRatingDelayDays ?? 7;
    const cutoff = new Date(
      Date.now() - delayDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const res = await this.hasuraSystemService.executeQuery<{
      orders: NudgeCandidateOrder[];
    }>(LIST_ORDERS_NEEDING_ITEM_RATING_NUDGE, {
      cutoff,
      limit: RatingsCronService.BATCH_LIMIT,
    });
    const orders = res.orders ?? [];

    let sent = 0;
    for (const order of orders) {
      try {
        if (await this.nudgeOrder(order)) sent += 1;
      } catch (error: any) {
        this.logger.error(
          `Item rating nudge failed for order ${order.order_number}: ${
            error?.message ?? String(error)
          }`
        );
      }
    }
    return sent;
  }

  /** True when at least one order line item still has no client_to_item rating. */
  private hasUnratedItems(order: NudgeCandidateOrder): boolean {
    const itemIds = new Set(
      (order.order_items ?? []).map((item) => item.item_id)
    );
    if (itemIds.size === 0) return false;
    const ratedIds = new Set(
      (order.ratings ?? []).map((rating) => rating.rated_entity_id)
    );
    return [...itemIds].some((id) => !ratedIds.has(id));
  }

  /** Returns true when a push was actually sent. */
  private async nudgeOrder(order: NudgeCandidateOrder): Promise<boolean> {
    // Mark first so a push failure never re-spams the client on the next run.
    // Fully rated orders are marked too, so they drop out of future scans.
    await this.hasuraSystemService.executeMutation(
      MARK_ITEM_RATING_NUDGE_SENT,
      { orderId: order.id, at: new Date().toISOString() }
    );

    const clientUserId = order.client?.user_id;
    if (!clientUserId || !this.hasUnratedItems(order)) return false;

    await this.notificationsService.sendRatePromptPush({
      clientUserId,
      orderId: order.id,
      orderNumber: order.order_number,
      kind: 'rate_item',
      preferredLanguage: order.client?.user?.preferred_language ?? null,
    });
    return true;
  }
}
