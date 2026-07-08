import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeConfig } from '../config/configuration';
import {
  StripePaymentEntity,
  StripePaymentsDatabaseService,
} from './stripe-payments-database.service';
import { StripeService } from './stripe.service';

export interface CreateCheckoutParams {
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  accountId?: string;
  paymentEntity?: StripePaymentEntity;
  entityId?: string;
  successUrl?: string;
  cancelUrl?: string;
  captureMethod?: 'automatic' | 'manual';
  taxLineItems?: import('../stripe-payments/stripe.service').StripeCheckoutTaxLineItem[];
  customerAddress?: import('../stripe-payments/stripe.service').StripeTaxCustomerAddress;
  automaticTax?: boolean;
  allowedShippingCountries?: string[];
}

export interface CreateCheckoutResult {
  transactionId: string;
  reference: string;
  sessionId: string;
  paymentUrl?: string;
}

export interface CreatePaymentIntentResult {
  transactionId: string;
  reference: string;
  paymentIntentId: string;
  clientSecret: string | null;
}

@Injectable()
export class StripeCheckoutService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly configService: ConfigService
  ) {}

  private generateReference(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).slice(2, 6);
    return `ST${timestamp}${random}`;
  }

  private get appBaseUrl(): string {
    return this.configService.get<StripeConfig>('stripe')?.appBaseUrl || '';
  }

  private buildSuccessUrl(params: CreateCheckoutParams, reference: string): string {
    if (params.successUrl) return params.successUrl;
    const orderSuffix =
      params.paymentEntity === 'order' && params.entityId
        ? `&order=${encodeURIComponent(params.entityId)}`
        : '';
    return `${this.appBaseUrl}/payment/success?reference=${reference}${orderSuffix}`;
  }

  private buildCancelUrl(params: CreateCheckoutParams, reference: string): string {
    return (
      params.cancelUrl ||
      `${this.appBaseUrl}/payment/return?reference=${reference}&status=cancel`
    );
  }

  private buildMetadata(
    params: CreateCheckoutParams,
    reference: string
  ): Record<string, string> {
    const metadata: Record<string, string> = { reference };
    if (params.paymentEntity) metadata.paymentEntity = params.paymentEntity;
    if (params.entityId) metadata.entityId = params.entityId;
    if (params.accountId) metadata.accountId = params.accountId;
    return metadata;
  }

  async createCheckout(
    params: CreateCheckoutParams
  ): Promise<CreateCheckoutResult> {
    const reference = this.generateReference();
    const successUrl = this.buildSuccessUrl(params, reference);
    const cancelUrl = this.buildCancelUrl(params, reference);

    const transaction = await this.databaseService.createTransaction({
      reference,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      account_id: params.accountId,
      transaction_type: 'PAYMENT',
      payment_entity: params.paymentEntity,
      entity_id: params.entityId,
      customer_email: params.customerEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      capture_method: params.captureMethod ?? 'automatic',
    });

    const session = await this.stripeService.createCheckoutSession({
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      reference,
      customerEmail: params.customerEmail,
      successUrl,
      cancelUrl,
      metadata: this.buildMetadata(params, reference),
      captureMethod: params.captureMethod,
      taxLineItems: params.taxLineItems,
      customerAddress: params.customerAddress,
      automaticTax: params.automaticTax,
      allowedShippingCountries: params.allowedShippingCountries,
    });

    await this.databaseService.updateTransaction(transaction.id, {
      stripe_session_id: session.id,
      payment_url: session.url ?? undefined,
    });

    return {
      transactionId: transaction.id,
      reference,
      sessionId: session.id,
      paymentUrl: session.url ?? undefined,
    };
  }

  /**
   * Create a PaymentIntent (instead of a hosted Checkout session) for native
   * client SDKs such as the mobile PaymentSheet. The transaction row carries
   * the same metadata so the `payment_intent.succeeded` webhook credits the
   * wallet and finalizes the entity exactly like the hosted flow.
   */
  async createPaymentIntent(
    params: CreateCheckoutParams
  ): Promise<CreatePaymentIntentResult> {
    const reference = this.generateReference();

    const transaction = await this.databaseService.createTransaction({
      reference,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      account_id: params.accountId,
      transaction_type: 'PAYMENT',
      payment_entity: params.paymentEntity,
      entity_id: params.entityId,
      customer_email: params.customerEmail,
      capture_method: params.captureMethod ?? 'automatic',
    });

    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      reference,
      customerEmail: params.customerEmail,
      metadata: this.buildMetadata(params, reference),
      captureMethod: params.captureMethod,
    });

    await this.databaseService.updateTransaction(transaction.id, {
      stripe_payment_intent_id: paymentIntent.id,
    });

    return {
      transactionId: transaction.id,
      reference,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    };
  }

  async updatePaymentIntentTax(
    paymentIntentId: string,
    amountTotal: number,
    currency: string,
    calculationId: string,
    reference: string
  ): Promise<void> {
    const existing = await this.stripeService.retrievePaymentIntent(paymentIntentId);
    await this.stripeService.updatePaymentIntentAmount(
      paymentIntentId,
      amountTotal,
      currency,
      `pi_tax_${reference}`
    );
    await this.stripeService.updatePaymentIntentMetadata(
      paymentIntentId,
      {
        ...(existing.metadata ?? {}),
        stripe_tax_calculation_id: calculationId,
      },
      `pi_meta_${reference}`
    );
  }
}
