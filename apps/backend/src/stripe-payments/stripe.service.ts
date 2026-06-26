import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeConfig } from '../config/configuration';

export interface CreateCheckoutSessionParams {
  amount: number;
  currency: string;
  description: string;
  reference: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
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

  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<Stripe.Checkout.Session> {
    return this.getClient().checkout.sessions.create(
      {
        mode: 'payment',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        client_reference_id: params.reference,
        customer_email: params.customerEmail,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: params.currency.toLowerCase(),
              unit_amount: this.toMinorUnits(params.amount, params.currency),
              product_data: { name: params.description },
            },
          },
        ],
        payment_intent_data: { metadata: params.metadata },
        metadata: { reference: params.reference, ...params.metadata },
      },
      { idempotencyKey: `checkout_${params.reference}` }
    );
  }

  /**
   * Create a PaymentIntent on the platform account for native client SDKs
   * (e.g. the mobile PaymentSheet). Mirrors the Checkout session settlement:
   * payment lands on the platform, wallets are credited via the webhook.
   */
  async createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<Stripe.PaymentIntent> {
    return this.getClient().paymentIntents.create(
      {
        amount: this.toMinorUnits(params.amount, params.currency),
        currency: params.currency.toLowerCase(),
        description: params.description,
        receipt_email: params.customerEmail,
        automatic_payment_methods: { enabled: true },
        metadata: { reference: params.reference, ...params.metadata },
      },
      { idempotencyKey: `pi_${params.reference}` }
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
  }): Promise<Stripe.Account> {
    return this.getClient().accounts.create(
      {
        type: 'express',
        country: params.country,
        email: params.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { userId: params.userId },
      },
      { idempotencyKey: `connect_account_${params.userId}` }
    );
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
}
