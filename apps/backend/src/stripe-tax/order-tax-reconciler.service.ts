import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderTaxLifecycleService } from './order-tax-lifecycle.service';

/**
 * Hourly sweep that finishes what the inline capture/refund hooks could not (a Stripe
 * timeout, a swallowed write, a lost webhook). OFF unless ORDER_TAX_RECONCILER_ENABLED=true,
 * because it creates Stripe Tax transactions/reversals; the admin endpoint
 * (POST admin/stripe-tax/reconcile, dry-run by default) does the same on demand.
 */
@Injectable()
export class OrderTaxReconcilerService {
  private readonly logger = new Logger(OrderTaxReconcilerService.name);
  private running = false;

  constructor(private readonly lifecycle: OrderTaxLifecycleService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (process.env.ORDER_TAX_RECONCILER_ENABLED !== 'true') return;
    if (this.running) return;
    this.running = true;
    try {
      await this.lifecycle.reconcileBatch({ dryRun: false, limit: 25 });
    } catch (error: any) {
      this.logger.error(`order_tax_reconcile_sweep_failed: ${error?.message}`);
    } finally {
      this.running = false;
    }
  }
}
