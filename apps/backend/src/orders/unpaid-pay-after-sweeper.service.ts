import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { OrdersService } from './orders.service';

const BATCH_LIMIT = 50;
/** Extra time after the scheduled timer would have fired, so the sweeper never races it. */
export const UNPAID_SWEEP_GRACE_MINUTES = 15;

export interface UnpaidSweepResult {
  found: number;
  cancelled: number;
  skipped: number;
  failed: number;
}

/**
 * Safety net for pay-after-confirm orders that were confirmed but never paid and whose
 * `order.cooked_food_unpaid_cancel` timer never fired (e.g. `scheduleUnpaidCancelAfterConfirm`
 * only logs a warning when scheduling fails, and the payment-failed grace cleanup only covers
 * `pending_payment` orders).
 *
 * Cancels through the same guarded path as the timer
 * (`OrdersService.cancelUnpaidCookedFoodAfterConfirm` -> `cancelUnpaidPendingPaymentAsSystem`),
 * which re-checks status/payment and releases reserved inventory. Reads only order snapshots.
 */
@Injectable()
export class UnpaidPayAfterSweeperService {
  private readonly logger = new Logger(UnpaidPayAfterSweeperService.name);
  private running = false;

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.runOnce();
      if (result.found > 0) {
        this.logger.log(`Unpaid pay-after sweep: ${JSON.stringify(result)}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Unpaid pay-after sweep failed: ${error?.message ?? String(error)}`
      );
    } finally {
      this.running = false;
    }
  }

  cutoff(now: Date): Date {
    const hours =
      this.configService.get<Configuration['order']>('order')
        ?.cookedFoodUnpaidCancelHours ?? 3;
    const minutes = hours * 60 + UNPAID_SWEEP_GRACE_MINUTES;
    return new Date(now.getTime() - minutes * 60 * 1000);
  }

  async runOnce(now: Date = new Date()): Promise<UnpaidSweepResult> {
    const result: UnpaidSweepResult = {
      found: 0,
      cancelled: 0,
      skipped: 0,
      failed: 0,
    };
    const ids = await this.fetchOverdue(this.cutoff(now));
    result.found = ids.length;
    for (const orderId of ids) {
      try {
        const outcome = await this.ordersService.cancelUnpaidCookedFoodAfterConfirm(
          orderId
        );
        if (outcome?.cancelled) result.cancelled += 1;
        else result.skipped += 1;
      } catch (error: any) {
        result.failed += 1;
        this.logger.error(
          `Unpaid pay-after sweep could not cancel ${orderId}: ${error?.message}`
        );
      }
    }
    return result;
  }

  private async fetchOverdue(cutoff: Date): Promise<string[]> {
    const data = await this.hasura.executeQuery<{
      orders: Array<{ id: string }>;
    }>(
      `query OverdueUnpaidPayAfter($cutoff: timestamptz!, $limit: Int!) {
        orders(
          where: {
            pay_after_merchant_confirm: { _eq: true }
            current_status: { _eq: confirmed }
            payment_status: { _nin: ["paid", "authorized"] }
            order_status_history: {
              _and: [
                { status: { _eq: confirmed } }
                { created_at: { _lte: $cutoff } }
              ]
            }
          }
          order_by: { updated_at: asc }
          limit: $limit
        ) { id }
      }`,
      { cutoff: cutoff.toISOString(), limit: BATCH_LIMIT }
    );
    return (data?.orders ?? []).map((o) => o.id);
  }
}
