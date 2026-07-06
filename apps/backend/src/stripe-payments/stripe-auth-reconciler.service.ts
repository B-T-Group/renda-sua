import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { StripeConfig } from '../config/configuration';
import { OrdersService } from '../orders/orders.service';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripeService } from './stripe.service';

interface StaleAuthorizedOrderRow {
  id: string;
  order_number: string;
  payment_status: string;
  current_status: string;
  updated_at: string;
}

@Injectable()
export class StripeAuthReconcilerService {
  private readonly logger = new Logger(StripeAuthReconcilerService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService
  ) {}

  private get config(): StripeConfig {
    return this.configService.get<StripeConfig>('stripe') as StripeConfig;
  }

  /** Reconcile Stripe PI status with platform records every 15 minutes. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileAuthorizedPayments(): Promise<void> {
    if (!this.config.manualCaptureEnabled) return;

    await this.reconcilePendingTransactions();
    await this.expireStaleAuthorizedOrders();
  }

  private async reconcilePendingTransactions(): Promise<void> {
    const query = `
      query StaleStripeTxs {
        stripe_payment_transactions(
          where: {
            capture_method: { _eq: "manual" }
            status: { _in: ["pending", "authorized", "capture_pending"] }
            payment_entity: { _eq: "order" }
          }
          limit: 50
        ) {
          id
          reference
          entity_id
          stripe_payment_intent_id
          status
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {});
      const rows = response.stripe_payment_transactions ?? [];
      for (const row of rows) {
        if (!row.stripe_payment_intent_id) continue;
        await this.syncTransactionFromStripe(row.id, row.stripe_payment_intent_id);
      }
    } catch (error: any) {
      this.logger.error(`Reconcile pending txs failed: ${error?.message}`);
    }
  }

  private async syncTransactionFromStripe(
    txId: string,
    paymentIntentId: string
  ): Promise<void> {
    try {
      const pi = await this.stripeService.retrievePaymentIntent(paymentIntentId);
      if (pi.status === 'requires_capture' && pi.amount_capturable > 0) {
        const tx = await this.databaseService.getTransactionById(txId);
        if (tx?.status === 'pending') {
          await this.databaseService.updateTransaction(txId, {
            status: 'authorized',
            authorized_at: new Date().toISOString(),
          });
        }
      } else if (pi.status === 'canceled') {
        await this.databaseService.updateTransaction(txId, {
          status: 'expired',
          error_message: 'Payment authorization expired or cancelled',
        });
      }
    } catch (error: any) {
      this.logger.warn(
        `Could not sync PI ${paymentIntentId}: ${error?.message}`
      );
    }
  }

  private async expireStaleAuthorizedOrders(): Promise<void> {
    const noAgentHours = this.config.authorizedNoAgentTimeoutHours ?? 48;
    const cutoff = new Date(
      Date.now() - noAgentHours * 60 * 60 * 1000
    ).toISOString();

    const query = `
      query StaleAuthorizedOrders($cutoff: timestamptz!) {
        orders(
          where: {
            payment_status: { _eq: "authorized" }
            payment_source: { _eq: credit_card }
            current_status: { _eq: "ready_for_pickup" }
            assigned_agent_id: { _is_null: true }
            fulfillment_method: { _neq: pickup }
            updated_at: { _lt: $cutoff }
          }
          limit: 20
        ) {
          id
          order_number
          payment_status
          current_status
          updated_at
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        cutoff,
      });
      const orders: StaleAuthorizedOrderRow[] = response.orders ?? [];
      for (const order of orders) {
        await this.cancelStaleOrder(order);
      }
    } catch (error: any) {
      this.logger.error(`Expire stale authorized orders failed: ${error?.message}`);
    }
  }

  private async cancelStaleOrder(order: StaleAuthorizedOrderRow): Promise<void> {
    this.logger.log(
      `Auto-cancelling stale authorized order ${order.order_number} (no agent)`
    );
    await this.ordersService.cancelStaleAuthorizedOrderAsSystem(order.id);
  }
}
