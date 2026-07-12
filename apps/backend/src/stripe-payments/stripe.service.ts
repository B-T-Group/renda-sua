import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeConfig } from '../config/configuration';
import { STRIPE_TAX_CODE_SHIPPING } from '../stripe-tax/stripe-tax.constants';

export interface CreateCheckoutSessionParams {
  amount: number;
  currency: string;
  description: string;
  reference: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  captureMethod?: 'automatic' | 'manual';
  /** When set with automatic tax, delivery fee is passed as a shipping option (not a line item). */
  deliveryFee?: number;
  taxLineItems?: StripeCheckoutTaxLineItem[];
  customerAddress?: StripeTaxCustomerAddress;
  automaticTax?: boolean;
  allowedShippingCountries?: string[];
  /** Recipient name for prefilled Checkout shipping (tax jurisdiction). */
  shippingName?: string;
}

export interface StripeCheckoutTaxLineItem {
  name: string;
  unitAmount: number;
  quantity: number;
  taxCode: string;
  reference?: string;
}

export interface StripeTaxCustomerAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface CreateTransferParams {
  amount: number;
  currency: string;
  destinationAccountId: string;
  reference: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  description: string;
  reference: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  captureMethod?: 'automatic' | 'manual';
}

@Injectable()
export class StripeService {
  private client: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  private get config(): StripeConfig {
    return this.configService.get<StripeConfig>('stripe') as StripeConfig;
  }

  private getClient(): Stripe {
    if (this.client) return this.client;
    const { secretKey, apiVersion } = this.config;
    if (!secretKey) {
      throw new Error('Stripe secret key is not configured');
    }
    this.client = new Stripe(secretKey, {
      apiVersion: apiVersion as Stripe.LatestApiVersion,
      typescript: true,
    });
    return this.client;
  }

  /** Smallest currency unit (Stripe expects cents for most currencies). */
  private toMinorUnits(amount: number, currency: string): number {
    const zeroDecimal = new Set(['XAF', 'XOF', 'JPY', 'KRW', 'VND', 'CLP']);
    if (zeroDecimal.has(currency.toUpperCase())) {
      return Math.round(amount);
    }
    return Math.round(amount * 100);
  }

  private buildCheckoutShippingOption(
    deliveryFee: number | undefined,
    currency: string
  ): Stripe.Checkout.SessionCreateParams.ShippingOption | null {
    if (!deliveryFee || deliveryFee <= 0) return null;
    const amount = this.toMinorUnits(deliveryFee, currency);
    if (amount <= 0) return null;
    return {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount, currency: currency.toLowerCase() },
        display_name: 'Delivery',
        tax_behavior: 'exclusive',
        tax_code: STRIPE_TAX_CODE_SHIPPING,
      },
    };
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<Stripe.Checkout.Session> {
    const captureMethod = params.captureMethod ?? 'automatic';
    const useTax = params.automaticTax && (params.taxLineItems?.length ?? 0) > 0;
    const lineItems = useTax
      ? params.taxLineItems!.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: params.currency.toLowerCase(),
            unit_amount: line.unitAmount,
            tax_behavior: 'exclusive' as const,
            product_data: {
              name: line.name,
              tax_code: line.taxCode,
              ...(line.reference ? { metadata: { reference: line.reference } } : {}),
            },
          },
        }))
      : [
          {
            quantity: 1,
            price_data: {
              currency: params.currency.toLowerCase(),
              unit_amount: this.toMinorUnits(params.amount, params.currency),
              product_data: { name: params.description },
            },
          },
        ];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.reference,
      customer_email: params.customerEmail,
      line_items: lineItems,
      metadata: { reference: params.reference, ...params.metadata },
    };

    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData =
      {
        capture_method: captureMethod,
        metadata: params.metadata,
      };

    if (useTax) {
      sessionParams.automatic_tax = { enabled: true };
      const shippingCost = this.buildCheckoutShippingOption(
        params.deliveryFee,
        params.currency
      );
      if (shippingCost) {
        sessionParams.shipping_options = [shippingCost];
      }
      if (params.customerAddress) {
        paymentIntentData.shipping = {
          name:
            params.shippingName?.trim() ||
            params.customerEmail?.split('@')[0] ||
            'Customer',
          address: {
            line1: params.customerAddress.line1,
            line2: params.customerAddress.line2 || undefined,
            city: params.customerAddress.city,
            state: params.customerAddress.state,
            postal_code: params.customerAddress.postal_code,
            country:
              params.customerAddress.country as Stripe.AddressParam['country'],
          },
        };
        sessionParams.billing_address_collection = 'auto';
      } else if (params.allowedShippingCountries?.length) {
        sessionParams.shipping_address_collection = {
          allowed_countries:
            params.allowedShippingCountries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
        };
      }
    }

    sessionParams.payment_intent_data = paymentIntentData;

    return this.getClient().checkout.sessions.create(
      sessionParams,
      { idempotencyKey: `checkout_${params.reference}` }
    );
  }

  async listAllTaxCodes(): Promise<Stripe.TaxCode[]> {
    const client = this.getClient();
    const all: Stripe.TaxCode[] = [];
    let startingAfter: string | undefined;
    for (;;) {
      const page = await client.taxCodes.list({
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      all.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    return all;
  }

  async retrieveCheckoutSessionExpanded(
    sessionId: string
  ): Promise<Stripe.Checkout.Session> {
    return this.getClient().checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'total_details.breakdown'],
    });
  }

  async createTaxCalculation(params: {
    currency: string;
    customerAddress: StripeTaxCustomerAddress;
    lineItems: StripeCheckoutTaxLineItem[];
    shippingCost?: { amount: number; taxCode: string } | null;
  }): Promise<Stripe.Tax.Calculation> {
    return this.getClient().tax.calculations.create({
      currency: params.currency.toLowerCase(),
      customer_details: {
        address: params.customerAddress,
        address_source: 'shipping',
      },
      line_items: params.lineItems.map((line) => ({
        amount: line.unitAmount * line.quantity,
        reference: line.reference ?? line.name,
        tax_code: line.taxCode,
        tax_behavior: 'exclusive',
      })),
      ...(params.shippingCost
        ? {
            shipping_cost: {
              amount: params.shippingCost.amount,
              tax_code: params.shippingCost.taxCode,
            },
          }
        : {}),
    });
  }

  async createTaxTransactionFromCalculation(
    calculationId: string,
    reference: string
  ): Promise<Stripe.Tax.Transaction> {
    return this.getClient().tax.transactions.createFromCalculation({
      calculation: calculationId,
      reference,
    });
  }

  async retrieveTaxCalculation(
    calculationId: string
  ): Promise<Stripe.Tax.Calculation> {
    return this.getClient().tax.calculations.retrieve(calculationId);
  }

  /**
   * Create a PaymentIntent on the platform account for native client SDKs
   * (e.g. the mobile PaymentSheet). Mirrors the Checkout session settlement:
   * payment lands on the platform, wallets are credited via the webhook.
   */
  async updatePaymentIntentAmount(
    paymentIntentId: string,
    amount: number,
    currency: string,
    idempotencyKey: string
  ): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.update(
      paymentIntentId,
      { amount: this.toMinorUnits(amount, currency) },
      { idempotencyKey }
    );
  }

  async updatePaymentIntentMetadata(
    paymentIntentId: string,
    metadata: Record<string, string>,
    idempotencyKey: string
  ): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.update(
      paymentIntentId,
      { metadata },
      { idempotencyKey }
    );
  }

  async createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<Stripe.PaymentIntent> {
    const captureMethod = params.captureMethod ?? 'automatic';
    return this.getClient().paymentIntents.create(
      {
        amount: this.toMinorUnits(params.amount, params.currency),
        currency: params.currency.toLowerCase(),
        description: params.description,
        receipt_email: params.customerEmail,
        capture_method: captureMethod,
        automatic_payment_methods: { enabled: true },
        metadata: { reference: params.reference, ...params.metadata },
      },
      { idempotencyKey: `pi_${params.reference}` }
    );
  }

  async capturePaymentIntent(
    paymentIntentId: string,
    idempotencyKey: string
  ): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.capture(
      paymentIntentId,
      {},
      { idempotencyKey }
    );
  }

  async cancelPaymentIntent(
    paymentIntentId: string,
    idempotencyKey: string
  ): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.cancel(
      paymentIntentId,
      {},
      { idempotencyKey }
    );
  }

  async retrieveCheckoutSession(
    sessionId: string
  ): Promise<Stripe.Checkout.Session> {
    return this.getClient().checkout.sessions.retrieve(sessionId);
  }

  async retrievePaymentIntent(
    paymentIntentId: string
  ): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.retrieve(paymentIntentId);
  }

  async expireCheckoutSession(
    sessionId: string
  ): Promise<Stripe.Checkout.Session> {
    return this.getClient().checkout.sessions.expire(sessionId);
  }

  constructEvent(
    payload: Buffer | string,
    signature: string,
    source: 'payments' | 'connect'
  ): Stripe.Event {
    const secret =
      source === 'connect'
        ? this.config.connectWebhookSecret
        : this.config.webhookSecret;
    if (!secret) {
      throw new Error(`Stripe ${source} webhook secret is not configured`);
    }
    return this.getClient().webhooks.constructEvent(payload, signature, secret);
  }

  async createExpressAccount(params: {
    country: string;
    email?: string;
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    businessName?: string;
  }): Promise<Stripe.Account> {
    const createParams = this.buildExpressAccountCreateParams(params);
    return this.getClient().accounts.create(createParams, {
      idempotencyKey: `connect_account_${params.userId}`,
    });
  }

  private buildExpressAccountCreateParams(params: {
    country: string;
    email?: string;
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    businessName?: string;
  }): Stripe.AccountCreateParams {
    const createParams: Stripe.AccountCreateParams = {
      type: 'express',
      country: params.country,
      email: params.email,
      business_type: 'individual',
      business_profile: this.buildBusinessProfilePrefill(params.businessName),
      individual: this.buildIndividualPrefill(params),
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { userId: params.userId },
    };
    return createParams;
  }

  /** Platform defaults shown during Connect onboarding for all environments. */
  private buildBusinessProfilePrefill(
    businessName?: string
  ): Stripe.AccountCreateParams.BusinessProfile {
    return {
      url: 'https://www.rendasua.com',
      product_description: 'Sell my stock online',
      // Specialty retail / miscellaneous — covers general goods sold via Rendasua.
      mcc: '5999',
      ...(businessName ? { name: businessName } : {}),
    };
  }

  private buildIndividualPrefill(params: {
    country: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Stripe.AccountCreateParams.Individual {
    const individual: Stripe.AccountCreateParams.Individual = {
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
    };
    if (params.phone?.startsWith('+')) {
      individual.phone = params.phone;
    }
    if (this.shouldPrefillDevConnectData()) {
      Object.assign(individual, this.buildDevIndividualPrefill(params.country));
    }
    return individual;
  }

  /** Non-production only: speed up Connect test onboarding with Stripe test tokens. */
  private shouldPrefillDevConnectData(): boolean {
    const nodeEnv =
      this.configService.get<string>('app.nodeEnv') || 'development';
    return nodeEnv !== 'production';
  }

  /**
   * Stripe test magic values: DOB 1901-01-01 and line1 `address_full_match`
   * (Canada / Quebec defaults when the connected account country is CA).
   */
  private buildDevIndividualPrefill(
    country: string
  ): Stripe.AccountCreateParams.Individual {
    const code = country.toUpperCase();
    const dob = { day: 1, month: 1, year: 1901 };
    if (code === 'CA') {
      return {
        dob,
        address: {
          line1: 'address_full_match',
          city: 'Montreal',
          state: 'QC',
          postal_code: 'H2Y1C6',
          country: 'CA',
        },
      };
    }
    return {
      dob,
      address: {
        line1: 'address_full_match',
        city: 'San Francisco',
        state: code === 'US' ? 'CA' : undefined,
        postal_code: code === 'US' ? '94111' : 'A1A1A1',
        country: code,
      },
    };
  }

  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string
  ): Promise<Stripe.AccountLink> {
    return this.getClient().accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
  }

  async createLoginLink(accountId: string): Promise<Stripe.LoginLink> {
    return this.getClient().accounts.createLoginLink(accountId);
  }

  async retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.getClient().accounts.retrieve(accountId);
  }

  async createTransfer(
    params: CreateTransferParams
  ): Promise<Stripe.Transfer> {
    return this.getClient().transfers.create(
      {
        amount: this.toMinorUnits(params.amount, params.currency),
        currency: params.currency.toLowerCase(),
        destination: params.destinationAccountId,
        description: params.description,
        metadata: { reference: params.reference, ...params.metadata },
      },
      { idempotencyKey: `transfer_${params.reference}` }
    );
  }

  async createRefund(params: {
    paymentIntentId: string;
    amount?: number;
    reason?: Stripe.RefundCreateParams.Reason;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<Stripe.Refund> {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: params.paymentIntentId,
      reason: params.reason || 'requested_by_customer',
      metadata: params.metadata,
    };

    if (params.amount !== undefined) {
      refundParams.amount = params.amount;
    }

    const idempotencyKey =
      params.idempotencyKey ??
      `refund_${params.metadata?.orderId ?? params.paymentIntentId}`;
    return this.getClient().refunds.create(refundParams, { idempotencyKey });
  }
}
