import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { resolveCurrencyFromCountry } from '../country-currency/country-currency.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { StripeCheckoutService } from '../stripe-payments/stripe-checkout.service';
import {
  CLEANUP_TOKEN_COST,
  getTokenPack,
  packPriceForCurrency,
  resolvePurchasedPack,
  SUPER_USER_AI_TOKENS,
  TOKEN_PACKS,
  type TokenPack,
  type TokenPackId,
} from './business-tokens.packs';

export type TokenUsageSubjectType =
  | 'business_image'
  | 'rental_item_image'
  | 'preview'
  | 'ai_image_cleanup';

export interface ConsumeTokenParams {
  businessId: string;
  userId: string;
  subjectType: TokenUsageSubjectType;
  subjectId?: string | null;
  imageUrl?: string | null;
}

@Injectable()
export class BusinessTokensService {
  private readonly logger = new Logger(BusinessTokensService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly stripeCheckoutService: StripeCheckoutService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly mobilePaymentsDatabaseService: MobilePaymentsDatabaseService
  ) {}

  listPacks() {
    return TOKEN_PACKS.map((pack) => ({
      id: pack.id,
      tokens: pack.tokens,
      prices: pack.prices,
    }));
  }

  async getBalance(businessId: string): Promise<number> {
    const result = await this.hasuraSystemService.executeQuery(
      `query GetBusinessAiTokens($id: uuid!) {
        businesses_by_pk(id: $id) { ai_tokens }
      }`,
      { id: businessId }
    );
    return result.businesses_by_pk?.ai_tokens ?? 0;
  }

  async ensureSuperUserTokens(businessId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation EnsureSuperUserTokens($id: uuid!, $min: Int!) {
        update_businesses(
          where: { id: { _eq: $id }, ai_tokens: { _lt: $min } }
          _set: { ai_tokens: $min }
        ) { affected_rows }
      }`,
      { id: businessId, min: SUPER_USER_AI_TOKENS }
    );
  }

  async setTokens(businessId: string, aiTokens: number): Promise<number> {
    if (!Number.isInteger(aiTokens) || aiTokens < 0) {
      throw new BadRequestException('ai_tokens must be a non-negative integer');
    }
    const result = await this.hasuraSystemService.executeMutation(
      `mutation SetBusinessAiTokens($id: uuid!, $ai_tokens: Int!) {
        update_businesses_by_pk(pk_columns: { id: $id }, _set: { ai_tokens: $ai_tokens }) {
          ai_tokens
        }
      }`,
      { id: businessId, ai_tokens: aiTokens }
    );
    return result.update_businesses_by_pk.ai_tokens;
  }

  async runCleanupWithToken<T>(
    params: ConsumeTokenParams,
    cleanupFn: () => Promise<T>
  ): Promise<{ result: T; balanceAfter: number }> {
    const balanceAfter = await this.tryDecrement(params.businessId);
    if (balanceAfter === null) {
      throw new HttpException(
        {
          success: false,
          error:
            'No AI tokens remaining. Purchase more tokens to use image cleanup.',
          code: 'INSUFFICIENT_AI_TOKENS',
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }
    let result: T;
    try {
      result = await cleanupFn();
    } catch (error: any) {
      await this.refundToken(params.businessId);
      throw error;
    }
    try {
      await this.insertUsage({
        ...params,
        tokensConsumed: CLEANUP_TOKEN_COST,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to record AI token usage for business ${params.businessId}: ${
          error?.message || error
        }`
      );
    }
    return { result, balanceAfter };
  }

  async refundToken(businessId: string): Promise<void> {
    await this.refundTokens(businessId, CLEANUP_TOKEN_COST);
  }

  async refundTokens(businessId: string, amount: number): Promise<void> {
    if (!Number.isInteger(amount) || amount <= 0) return;
    await this.hasuraSystemService.executeMutation(
      `mutation RefundAiTokens($id: uuid!, $amount: Int!) {
        update_businesses_by_pk(pk_columns: { id: $id }, _inc: { ai_tokens: $amount }) {
          ai_tokens
        }
      }`,
      { id: businessId, amount }
    );
  }

  /** Atomically reserve `amount` tokens. Returns balance after, or null if insufficient. */
  async tryReserveTokens(
    businessId: string,
    amount: number
  ): Promise<number | null> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Token amount must be a positive integer');
    }
    const result = await this.hasuraSystemService.executeMutation(
      `mutation ReserveAiTokens($id: uuid!, $cost: Int!, $delta: Int!) {
        update_businesses(
          where: { id: { _eq: $id }, ai_tokens: { _gte: $cost } }
          _inc: { ai_tokens: $delta }
        ) {
          returning { ai_tokens }
        }
      }`,
      { id: businessId, cost: amount, delta: -amount }
    );
    const row = result.update_businesses?.returning?.[0];
    return row ? row.ai_tokens : null;
  }

  async recordCleanupUsage(params: ConsumeTokenParams & { tokensConsumed: number }) {
    await this.insertUsage(params);
  }

  async grantPackTokens(
    businessId: string,
    tokens: number,
    reference: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation GrantAiTokens($id: uuid!, $amount: Int!) {
        update_businesses_by_pk(pk_columns: { id: $id }, _inc: { ai_tokens: $amount }) {
          ai_tokens
        }
      }`,
      { id: businessId, amount: tokens }
    );
    this.logger.log(
      `Granted ${tokens} AI tokens to business ${businessId} (ref ${reference})`
    );
  }

  async processTokenPaymentSuccess(transaction: {
    entity_id?: string | null;
    reference?: string | null;
    amount: number;
    currency: string;
    description?: string | null;
  }): Promise<void> {
    const businessId = transaction.entity_id;
    if (!businessId) {
      throw new Error('Token payment missing business id (entity_id)');
    }
    const pack = resolvePurchasedPack({
      amount: Number(transaction.amount),
      currency: transaction.currency,
      description: transaction.description,
    });
    if (!pack) {
      throw new Error(
        `No token pack for ${transaction.amount} ${transaction.currency}`
      );
    }
    await this.grantPackTokens(
      businessId,
      pack.tokens,
      transaction.reference ?? businessId
    );
  }

  async initiatePackPurchase(params: {
    packId: TokenPackId;
    phoneNumber?: string;
    stripePaymentMethod?: 'checkout' | 'payment_sheet';
  }) {
    const user = await this.requireBusinessUser();
    const businessId = user.business!.id as string;
    const pack = getTokenPack(params.packId);
    if (!pack) {
      throw new BadRequestException('Invalid token pack');
    }
    const currency = await this.resolveBusinessCurrency(businessId);
    const amount = packPriceForCurrency(pack, currency);
    if (amount === null) {
      throw new BadRequestException(
        `Token packs are not available in ${currency}`
      );
    }
    const rail = await this.paymentRoutingService.resolveRailForBusiness(businessId);
    if (rail === 'stripe') {
      return this.initiateStripePurchase({
        businessId,
        pack,
        amount,
        currency,
        email: user.email,
        stripePaymentMethod: params.stripePaymentMethod,
      });
    }
    return this.initiateMobilePurchase({
      businessId,
      userId: user.id,
      pack,
      amount,
      currency,
      phoneNumber: params.phoneNumber || user.phone_number,
      email: user.email,
    });
  }

  async listUsage(businessId: string, limit = 50) {
    const result = await this.hasuraSystemService.executeQuery(
      `query ListAiTokenUsage($businessId: uuid!, $limit: Int!) {
        business_ai_token_usage(
          where: { business_id: { _eq: $businessId } }
          order_by: { created_at: desc }
          limit: $limit
        ) {
          id business_id tokens_consumed operation_type subject_type
          subject_id image_url created_by_user_id created_at
        }
      }`,
      { businessId, limit }
    );
    return result.business_ai_token_usage ?? [];
  }

  private async tryDecrement(businessId: string): Promise<number | null> {
    const result = await this.hasuraSystemService.executeMutation(
      `mutation ConsumeAiToken($id: uuid!, $cost: Int!, $delta: Int!) {
        update_businesses(
          where: { id: { _eq: $id }, ai_tokens: { _gte: $cost } }
          _inc: { ai_tokens: $delta }
        ) {
          returning { ai_tokens }
        }
      }`,
      {
        id: businessId,
        cost: CLEANUP_TOKEN_COST,
        delta: -CLEANUP_TOKEN_COST,
      }
    );
    const row = result.update_businesses?.returning?.[0];
    return row ? row.ai_tokens : null;
  }

  private async insertUsage(
    params: ConsumeTokenParams & { tokensConsumed: number }
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation InsertAiTokenUsage($object: business_ai_token_usage_insert_input!) {
        insert_business_ai_token_usage_one(object: $object) { id }
      }`,
      {
        object: {
          business_id: params.businessId,
          tokens_consumed: params.tokensConsumed,
          operation_type: 'image_cleanup',
          subject_type: params.subjectType,
          subject_id: params.subjectId ?? null,
          image_url: params.imageUrl ?? null,
          created_by_user_id: params.userId,
        },
      }
    );
  }

  private async requireBusinessUser() {
    const user = await this.hasuraUserService.getUser();
    if (!user?.business?.id) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }
    return user;
  }

  private async resolveBusinessCurrency(businessId: string): Promise<string> {
    const country =
      await this.paymentRoutingService.getBusinessCountryCode(businessId);
    return resolveCurrencyFromCountry(
      country,
      (query, variables) =>
        this.hasuraSystemService.executeQuery(query, variables)
    );
  }

  private async initiateStripePurchase(params: {
    businessId: string;
    pack: TokenPack;
    amount: number;
    currency: string;
    email?: string | null;
    stripePaymentMethod?: 'checkout' | 'payment_sheet';
  }) {
    const description = `AI tokens pack ${params.pack.tokens}`;
    if (params.stripePaymentMethod === 'payment_sheet') {
      const intent = await this.stripeCheckoutService.createPaymentIntent({
        amount: params.amount,
        currency: params.currency,
        description,
        paymentEntity: 'token',
        entityId: params.businessId,
        customerEmail: params.email ?? undefined,
        captureMethod: 'automatic',
      });
      if (!intent.clientSecret) {
        throw new HttpException(
          'Failed to create Stripe PaymentIntent',
          HttpStatus.BAD_GATEWAY
        );
      }
      return {
        success: true,
        payment_rail: 'stripe' as const,
        payment_method: 'payment_sheet' as const,
        reference: intent.reference,
        payment_intent_client_secret: intent.clientSecret,
        payment_transaction_id: intent.transactionId,
        paymentPending: true,
        tokens: params.pack.tokens,
        amount: params.amount,
        currency: params.currency,
      };
    }
    const checkout = await this.stripeCheckoutService.createCheckout({
      amount: params.amount,
      currency: params.currency,
      description,
      paymentEntity: 'token',
      entityId: params.businessId,
      customerEmail: params.email ?? undefined,
      captureMethod: 'automatic',
    });
    return {
      success: true,
      payment_rail: 'stripe' as const,
      payment_method: 'checkout' as const,
      reference: checkout.reference,
      paymentUrl: checkout.paymentUrl,
      tokens: params.pack.tokens,
      amount: params.amount,
      currency: params.currency,
    };
  }

  private async initiateMobilePurchase(params: {
    businessId: string;
    userId: string;
    pack: TokenPack;
    amount: number;
    currency: string;
    phoneNumber?: string | null;
    email?: string | null;
  }) {
    const phone = (params.phoneNumber || '').trim();
    if (!phone) {
      throw new BadRequestException(
        'Phone number is required for mobile money payment'
      );
    }
    if (params.currency !== 'XAF') {
      throw new BadRequestException(
        'Mobile money payments are only supported for XAF currency'
      );
    }
    const reference = this.buildTokenPaymentReference(params.businessId);
    const provider = this.mobilePaymentsService.getProvider(phone);
    const isMyPVitLike = provider === 'mypvit';
    const providerReference = isMyPVitLike
      ? reference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
      : reference;
    const description = isMyPVitLike
      ? providerReference
      : `AI tokens ${params.pack.tokens}`;

    await this.mobilePaymentsDatabaseService.createTransaction({
      reference: providerReference,
      amount: params.amount,
      currency: params.currency,
      description,
      provider,
      payment_method: 'mobile_money',
      customer_phone: phone,
      ...(params.email ? { customer_email: params.email } : {}),
      transaction_type: 'PAYMENT',
      payment_entity: 'token',
      entity_id: params.businessId,
    });

    const paymentResponse = await this.mobilePaymentsService.initiatePayment(
      {
        amount: params.amount,
        currency: params.currency,
        description,
        customerPhone: phone,
        provider,
        ownerCharge: 'CUSTOMER' as const,
        transactionType: 'PAYMENT' as const,
      },
      providerReference,
      params.userId
    );

    if (!paymentResponse.success) {
      throw new HttpException(
        paymentResponse.message || 'Failed to initiate payment',
        HttpStatus.BAD_REQUEST
      );
    }

    return {
      success: true,
      payment_rail: 'mobile_money' as const,
      paymentPending: true,
      reference: providerReference,
      tokens: params.pack.tokens,
      amount: params.amount,
      currency: params.currency,
    };
  }

  private buildTokenPaymentReference(businessId: string): string {
    const nonce = Math.random().toString(36).slice(2, 8);
    return `TKN-${businessId.replace(/-/g, '').slice(0, 8)}-${Date.now()}-${nonce}`;
  }
}
