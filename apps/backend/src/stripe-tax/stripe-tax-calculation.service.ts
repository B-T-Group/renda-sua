import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeConfig } from '../config/configuration';
import { StripeService } from '../stripe-payments/stripe.service';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';
import { StripeTaxOrderPersistenceService } from './stripe-tax-order-persistence.service';
import type { OrderTaxLineInput } from './stripe-tax-checkout-builder.service';

export interface CalculateOrderTaxParams {
  orderNumber: string;
  currency: string;
  orderItems: OrderTaxLineInput[];
  deliveryFee: number;
  discountAmount: number;
  deliveryAddress: {
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  transactionId: string;
  finalizeOnSuccess?: boolean;
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
    private readonly taxPersistence: StripeTaxOrderPersistenceService,
    private readonly configService: ConfigService
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

    if (params.finalizeOnSuccess) {
      let taxTransactionId: string | undefined;
      try {
        const tx = await this.stripeService.createTaxTransactionFromCalculation(
          calculationId,
          params.orderNumber
        );
        taxTransactionId = tx.id ?? undefined;
      } catch {
        // Non-fatal if transaction creation fails before payment
      }
      await this.taxPersistence.finalizeFromTaxCalculation({
        orderNumber: params.orderNumber,
        calculation,
        transactionId: params.transactionId,
        taxTransactionId,
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