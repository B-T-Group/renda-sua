import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderTaxLifecycleService } from './order-tax-lifecycle.service';

/**
 * Hourly sweep that finishes what the inline capture/refund hooks could not (a Stripe
 * timeout, a swallowed write, a lost webhook).
 *
 * - ON by default; set ORDER_TAX_RECONCILER_ENABLED=false to switch it off.
 * - DRY-RUN by default: it only logs (`order_tax_reconcile_summary dryRun=true ... would_finalize=N`)
 *   and writes nothing, because a real sweep creates Stripe Tax transactions/reversals.
 *   Set ORDER_TAX_RECONCILER_DRY_RUN=false to let it write (a deliberate, separate step).
 * - The admin endpoint (POST admin/stripe-tax/reconcile, dry-run unless dryRun=false,
 *   admin-auth only) does the same on demand.
 * - Late finalizations post to the CURRENT tax period (Stripe's default posted_at = now).
 */
@Injectable()
export class OrderTaxReconcilerService {
  private readonly logger = new Logger(OrderTaxReconcilerService.name);
  private running = false;

  constructor(private readonly lifecycle: OrderTaxLifecycleService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (process.env.ORDER_TAX_RECONCILER_ENABLED === 'false') return;
    if (this.running) return;
    this.running = true;
    // Safe default: log-only until ORDER_TAX_RECONCILER_DRY_RUN is explicitly 'false'.
    const dryRun = process.env.ORDER_TAX_RECONCILER_DRY_RUN !== 'false';
    try {
      await this.lifecycle.reconcileBatch({ dryRun, limit: 25 });
    } catch (error: any) {
      this.logger.error(`order_tax_reconcile_sweep_failed: ${error?.message}`);
    } finally {
      this.running = false;
    }
  }
}
