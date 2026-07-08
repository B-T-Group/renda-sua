import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { StripePaymentsDatabaseService } from '../stripe-payments/stripe-payments-database.service';
import { StripeService } from '../stripe-payments/stripe.service';
import { OrderTaxStatus } from './stripe-tax.constants';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';

@Injectable()
export class StripeTaxOrderPersistenceService {
  private readonly logger = new Logger(StripeTaxOrderPersistenceService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly stripeService: StripeService,
    private readonly paymentsDb: StripePaymentsDatabaseService,
    private readonly taxBuilder: StripeTaxCheckoutBuilderService
  ) {}

  async finalizeFromCheckoutSession(
    orderNumber: string,
    session: Stripe.Checkout.Session,
    transactionId: string
  ): Promise<void> {
    const order = await this.getOrderByNumber(orderNumber);
    if (!order) {
      this.logger.warn(`Tax finalize: order not found ${orderNumber}`);
      return;
    }
    if (order.tax_status === 'finalized') return;

    const expanded =
      session.total_details?.amount_tax != null
        ? session
        : await this.stripeService.retrieveCheckoutSessionExpanded(session.id);

    const taxAmountMajor = this.majorAmount(
      expanded.total_details?.amount_tax ?? 0,
      order.currency
    );
    const totalMajor = this.majorAmount(expanded.amount_total ?? 0, order.currency);
    const subtotalMajor = this.majorAmount(
      expanded.amount_subtotal ?? 0,
      order.currency
    );

    await this.hasura.executeMutation(
      `
      mutation FinalizeOrderTax(
        $orderId: uuid!
        $taxAmount: numeric!
        $totalAmount: numeric!
        $taxStatus: String!
        $jurisdiction: jsonb
        $breakdown: jsonb
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            tax_amount: $taxAmount
            total_amount: $totalAmount
            tax_status: $taxStatus
            tax_jurisdiction: $jurisdiction
            tax_breakdown: $breakdown
            updated_at: "now()"
          }
        ) { id }
      }
    `,
      {
        orderId: order.id,
        taxAmount: taxAmountMajor,
        totalAmount: totalMajor,
        taxStatus: 'finalized' as OrderTaxStatus,
        jurisdiction: this.extractJurisdiction(expanded),
        breakdown: expanded.total_details?.breakdown ?? null,
      }
    );

    await this.paymentsDb.updateTransaction(transactionId, {
      amount: totalMajor,
      amount_subtotal: subtotalMajor,
      amount_tax: taxAmountMajor,
    });
  }

  async finalizeFromTaxCalculation(params: {
    orderNumber: string;
    calculation: Stripe.Tax.Calculation;
    transactionId: string;
    taxTransactionId?: string;
  }): Promise<void> {
    const order = await this.getOrderByNumber(params.orderNumber);
    if (!order || order.tax_status === 'finalized') return;

    const taxAmountMajor = this.majorAmount(
      params.calculation.tax_amount_exclusive,
      order.currency
    );
    const totalMajor = this.majorAmount(
      params.calculation.amount_total,
      order.currency
    );
    const subtotalMajor = totalMajor - taxAmountMajor;

    await this.hasura.executeMutation(
      `
      mutation FinalizeOrderTaxCalc(
        $orderId: uuid!
        $taxAmount: numeric!
        $totalAmount: numeric!
        $calculationId: String!
        $taxTransactionId: String
        $breakdown: jsonb
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            tax_amount: $taxAmount
            total_amount: $totalAmount
            tax_status: "finalized"
            stripe_tax_calculation_id: $calculationId
            stripe_tax_transaction_id: $taxTransactionId
            tax_breakdown: $breakdown
            updated_at: "now()"
          }
        ) { id }
      }
    `,
      {
        orderId: order.id,
        taxAmount: taxAmountMajor,
        totalAmount: totalMajor,
        calculationId: params.calculation.id,
        taxTransactionId: params.taxTransactionId ?? undefined,
        breakdown: params.calculation.tax_breakdown ?? null,
      }
    );

    await this.paymentsDb.updateTransaction(params.transactionId, {
      amount: totalMajor,
      amount_subtotal: subtotalMajor,
      amount_tax: taxAmountMajor,
      stripe_tax_calculation_id: params.calculation.id ?? undefined,
    });
  }

  private async getOrderByNumber(orderNumber: string): Promise<{
    id: string;
    currency: string;
    tax_status: string;
  } | null> {
    const query = `
      query OrderForTax($orderNumber: String!) {
        orders(where: { order_number: { _eq: $orderNumber } }, limit: 1) {
          id
          currency
          tax_status
        }
      }
    `;
    const response = await this.hasura.executeQuery(query, { orderNumber });
    return response.orders?.[0] ?? null;
  }

  private majorAmount(minor: number, currency: string): number {
    return this.taxBuilder.fromMinorUnits(minor, currency);
  }

  private extractJurisdiction(
    session: Stripe.Checkout.Session
  ): Record<string, string> | null {
    const addr = session.customer_details?.address;
    if (!addr) return null;
    return {
      country: addr.country ?? '',
      state: addr.state ?? '',
      postal_code: addr.postal_code ?? '',
      city: addr.city ?? '',
    };
  }
}
