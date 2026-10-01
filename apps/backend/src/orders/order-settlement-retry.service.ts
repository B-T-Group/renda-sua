import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { OrdersService } from './orders.service';
import {
  SETTLEMENT_RETRY_LEASE_MINUTES,
  SettlementStage,
} from './order-settlement-retry.util';

const BATCH_LIMIT = 50;

export interface SettlementRetryRow {
  id: string;
  order_id: string;
  settlement_failed_stage: SettlementStage;
  settlement_next_retry_at: string;
}

export interface SettlementRetryResult {
  claimed: number;
  settled: number;
  stillFailing: number;
  skipped: number;
}

/**
 * Retries settlement stages (item / delivery commission distribution) that failed after
 * the order was already completed/advanced. The queue is `order_holds` itself
 * (`settlement_failed_stage` + `settlement_next_retry_at`), so no new table is needed.
 *
 * Idempotency relies on the existing guards: client movements are done-once (hold amounts
 * zeroed before distribution) and `CommissionsService.payCommission` skips recipients whose
 * deposit (account + order reference + deterministic memo) already exists.
 */
@Injectable()
export class OrderSettlementRetryService {
  private readonly logger = new Logger(OrderSettlementRetryService.name);
  private running = false;

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly ordersService: OrdersService
  ) {}

  /** Single-flight per instance; cross-instance safety comes from the DB lease. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.runOnce();
      if (result.claimed > 0) {
        this.logger.log(`Settlement retry sweep: ${JSON.stringify(result)}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Settlement retry sweep failed: ${error?.message ?? String(error)}`
      );
    } finally {
      this.running = false;
    }
  }

  async runOnce(now: Date = new Date()): Promise<SettlementRetryResult> {
    const result: SettlementRetryResult = {
      claimed: 0,
      settled: 0,
      stillFailing: 0,
      skipped: 0,
    };
    const due = await this.fetchDue(now);
    for (const row of due) {
      if (!(await this.claim(row, now))) {
        result.skipped += 1;
        continue;
      }
      result.claimed += 1;
      try {
        const settled = await this.retryHold(row);
        if (settled) result.settled += 1;
        else result.stillFailing += 1;
      } catch (error: any) {
        // Unexpected (non-distribution) failure: keep the marker, the lease expires
        // and the hold is picked up again. Alert so it does not stay invisible.
        result.stillFailing += 1;
        reportMoneyAnomaly(
          this.logger,
          'settlement_retry_error',
          `orderId=${row.order_id} stage=${row.settlement_failed_stage}: ${error?.message}`,
          { orderId: row.order_id, stage: row.settlement_failed_stage }
        );
      }
    }
    return result;
  }

  private async fetchDue(now: Date): Promise<SettlementRetryRow[]> {
    const data = await this.hasura.executeQuery(
      `query SettlementRetryDue($now: timestamptz!, $limit: Int!) {
        order_holds(
          where: {
            settlement_failed_stage: { _is_null: false }
            settlement_next_retry_at: { _lte: $now }
          }
          order_by: { settlement_next_retry_at: asc }
          limit: $limit
        ) {
          id
          order_id
          settlement_failed_stage
          settlement_next_retry_at
        }
      }`,
      { now: now.toISOString(), limit: BATCH_LIMIT }
    );
    return data?.order_holds ?? [];
  }

  /** Lease the row: only one instance can move next_retry_at away from the value it read. */
  private async claim(row: SettlementRetryRow, now: Date): Promise<boolean> {
    const leaseUntil = new Date(
      now.getTime() + SETTLEMENT_RETRY_LEASE_MINUTES * 60_000
    ).toISOString();
    const data = await this.hasura.executeMutation(
      `mutation ClaimSettlementRetry($id: uuid!, $expected: timestamptz!, $lease: timestamptz!) {
        update_order_holds(
          where: { id: { _eq: $id }, settlement_next_retry_at: { _eq: $expected } }
          _set: { settlement_next_retry_at: $lease }
        ) { affected_rows }
      }`,
      {
        id: row.id,
        expected: row.settlement_next_retry_at,
        lease: leaseUntil,
      }
    );
    return (data?.update_order_holds?.affected_rows ?? 0) === 1;
  }

  private async isOrderComplete(orderId: string): Promise<boolean> {
    const data = await this.hasura.executeQuery(
      `query SettlementRetryOrderStatus($id: uuid!) {
        orders_by_pk(id: $id) { current_status }
      }`,
      { id: orderId }
    );
    return data?.orders_by_pk?.current_status === 'complete';
  }

  /** Returns true when nothing is left to retry for this hold. */
  private async retryHold(row: SettlementRetryRow): Promise<boolean> {
    const opts = { isRetry: true };
    if (row.settlement_failed_stage === 'item') {
      const item = await this.ordersService.processOrderPayment(
        row.order_id,
        opts
      );
      if (item !== 'settled') return false;
      // Delivery settlement may have been deferred while the item stage was queued.
      // If the order already completed, nobody else will run it, so do it now. While
      // the order is still in transit the normal completeDelivery flow runs it.
      if (await this.isOrderComplete(row.order_id)) {
        const delivery = await this.ordersService.processOrderDeliveryPayment(
          row.order_id,
          opts
        );
        if (delivery !== 'settled') return false;
      }
    } else {
      const delivery = await this.ordersService.processOrderDeliveryPayment(
        row.order_id,
        opts
      );
      if (delivery !== 'settled') return false;
    }
    await this.ordersService.clearSettlementFailure(row.id);
    this.logger.log(
      `settlement_retry_succeeded orderId=${row.order_id} stage=${row.settlement_failed_stage}`
    );
    return true;
  }
}
