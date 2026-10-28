import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeConfig } from '../config/configuration';
import { StripeService } from '../stripe-payments/stripe.service';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';
import { OrderTaxLifecycleService } from './order-tax-lifecycle.service';
import type { OrderTaxLineInput } from './stripe-tax-checkout-builder.service';

export interface CalculateOrderTaxParams {
  orderNumber: string;
  /** When set, the calculation is persisted as an order_tax_snapshots row. */
  orderId?: string;
  currency: string;
  orderItems: OrderTaxLineInput[];
  deliveryFee: number;
  discountAmount: number;
  serviceFee?: number;
  deliveryAddress: {
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  transactionId: string;
}

export interface CalculateOrderTaxResult {
  calculationId: string;
  amountTotal: number;
  amountTax: number;
  amountSubtotal: number;
  clientSecret?: string | null;
}

@Injectable()
export class StripeTaxCalculationService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly taxBuilder: StripeTaxCheckoutBuilderService,
    private readonly configService: ConfigService,
    private readonly taxLifecycle: OrderTaxLifecycleService
  ) {}

  private get config(): StripeConfig {
    return this.configService.get<StripeConfig>('stripe') as StripeConfig;
  }

  async calculateForOrder(
    params: CalculateOrderTaxParams
  ): Promise<CalculateOrderTaxResult | null> {
    if (!this.config.taxEnabled) return null;
    const customerAddress = this.taxBuilder.addressFromRecord(
      params.deliveryAddress
    );
    if (!customerAddress) return null;
    if (!this.taxBuilder.isTaxEnabledForCountry(customerAddress.country)) {
      return null;
    }

    const lineItems = this.taxBuilder.buildLineItems({
      currency: params.currency,
      orderItems: params.orderItems,
      deliveryFee: 0,
      discountAmount: params.discountAmount,
      serviceFee: params.serviceFee,
      customerAddress,
    });
    if (lineItems.length === 0 && params.deliveryFee <= 0) return null;

    const shippingCost = this.taxBuilder.buildShippingCostForTax(
      params.deliveryFee,
      params.currency
    );

    const calculation = await this.stripeService.createTaxCalculation({
      currency: params.currency,
      customerAddress,
      lineItems,
      shippingCost,
    });

    const amountTotal = this.taxBuilder.fromMinorUnits(
      calculation.amount_total,
      params.currency
    );
    const amountTax = this.taxBuilder.fromMinorUnits(
      calculation.tax_amount_exclusive,
      params.currency
    );
    const amountSubtotal = amountTotal - amountTax;

    const calculationId = calculation.id ?? '';
    if (!calculationId) return null;

    if (params.orderId) {
      // Best effort: the snapshot must never block checkout.
      await this.taxLifecycle.recordEstimate({
        orderId: params.orderId,
        currency: params.currency,
        calculation,
      });
    }

    return {
      calculationId,
      amountTotal,
      amountTax,
      amountSubtotal,
    };
  }
}