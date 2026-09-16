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
  getReelAiTokenPack,
  reelAiPackPriceForCurrency,
  REEL_AI_TOKEN_COST,
  REEL_AI_TOKEN_PACKS,
  resolvePurchasedReelAiPack,
  type ReelAiTokenPack,
  type ReelAiTokenPackId,
} from './reel-ai-tokens.packs';

@Injectable()
export class ReelAiTokensService {
  private readonly logger = new Logger(ReelAiTokensService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly stripeCheckoutService: StripeCheckoutService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly mobilePaymentsDatabaseService: MobilePaymentsDatabaseService
  ) {}

  listPacks() {
    return REEL_AI_TOKEN_PACKS.map((pack) => ({
      id: pack.id,
      tokens: pack.tokens,
      prices: pack.prices,
    }));
  }

  async getBalance(businessId: string): Promise<number> {
    const result = await this.hasuraSystemService.executeQuery<{
      businesses_by_pk: { ai_reel_tokens: number } | null;
    }>(
      `query GetBusinessAiReelTokens($id: uuid!) {
        businesses_by_pk(id: $id) { ai_reel_tokens }
      }`,
      { id: businessId }
    );
    return result.businesses_by_pk?.ai_reel_tokens ?? 0;
  }

  /** Atomically reserve tokens. Returns balance after, or null if insufficient. */
  async tryReserveTokens(
    businessId: string,
    amount = REEL_AI_TOKEN_COST
  ): Promise<number | null> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Token amount must be a positive integer');
    }
    const result = await this.hasuraSystemService.executeMutation<{
      update_businesses: { returning: Array<{ ai_reel_tokens: number }> };
    }>(
      `mutation ReserveAiReelTokens($id: uuid!, $cost: Int!, $delta: Int!) {
        update_businesses(
          where: { id: { _eq: $id }, ai_reel_tokens: { _gte: $cost } }
          _inc: { ai_reel_tokens: $delta }
        ) {
          returning { ai_reel_tokens }
        }
      }`,
      { id: businessId, cost: amount, delta: -amount }
    );
    const row = result.update_businesses?.returning?.[0];
    return row ? row.ai_reel_tokens : null;
  }

  async refundTokens(businessId: string, amount = REEL_AI_TOKEN_COST): Promise<void> {
    if (!Number.isInteger(amount) || amount <= 0) return;
    await this.hasuraSystemService.executeMutation(
      `mutation RefundAiReelTokens($id: uuid!, $amount: Int!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _inc: { ai_reel_tokens: $amount }
        ) { ai_reel_tokens }
      }`,
      { id: businessId, amount }
    );
  }

  async recordUsage(params: {
    businessId: string;
    userId?: string | null;
    reelId?: string | null;
    tokensConsumed: number;
    operationType: 'generate' | 'purchase' | 'refund';
    paymentReference?: string | null;
  }): Promise<boolean> {
    try {
      await this.hasuraSystemService.executeMutation(
        `mutation InsertAiReelTokenUsage($object: business_ai_reel_token_usage_insert_input!) {
          insert_business_ai_reel_token_usage_one(object: $object) { id }
        }`,
        {
          object: {
            business_id: params.businessId,
            tokens_consumed: params.tokensConsumed,
            operation_type: params.operationType,
            reel_id: params.reelId ?? null,
            payment_reference: params.paymentReference ?? null,
            created_by_user_id: params.userId ?? null,
          },
        }
      );
      return true;
    } catch (error: any) {
      if (params.paymentReference && this.isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  async grantPackTokens(
    businessId: string,
    tokens: number,
    reference: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation GrantAiReelTokens($id: uuid!, $amount: Int!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _inc: { ai_reel_tokens: $amount }
        ) { ai_reel_tokens }
      }`,
      { id: businessId, amount: tokens }
    );
    this.logger.log(
      `Granted ${tokens} AI reel tokens to business ${businessId} (ref ${reference})`
    );
  }

  async processPaymentSuccess(transaction: {
    entity_id?: string | null;
    reference?: string | null;
    amount: number;
    currency: string;
  }): Promise<void> {
    const businessId = transaction.entity_id;
    if (!businessId) {
      throw new Error('Reel AI token payment missing business id (entity_id)');
    }
    const pack = resolvePurchasedReelAiPack({
      amount: Number(transaction.amount),
      currency: transaction.currency,
    });
    if (!pack) {
      throw new Error(
        `No reel AI token pack for ${transaction.amount} ${transaction.currency}`
      );
    }
    const paymentReference = transaction.reference ?? businessId;
    const claimed = await this.recordUsage({
      businessId,
      tokensConsumed: pack.tokens,
      operationType: 'purchase',
      paymentReference,
    });
    if (!claimed) {
      this.logger.log(
        `Skipping duplicate reel AI token grant for payment ${paymentReference}`
      );
      return;
    }
    try {
      await this.grantPackTokens(businessId, pack.tokens, paymentReference);
    } catch (error: any) {
      await this.deleteUsageByPaymentReference(paymentReference);
      throw error;
    }
  }

  private async deleteUsageByPaymentReference(
    paymentReference: string
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation DeleteAiReelTokenPurchaseClaim($ref: String!) {
        delete_business_ai_reel_token_usage(
          where: { payment_reference: { _eq: $ref } }
        ) { affected_rows }
      }`,
      { ref: paymentReference }
    );
  }

  private isUniqueViolation(error: any): boolean {
    const message = String(error?.message || error || '');
    return (
      message.includes('Uniqueness violation') ||
      message.includes('unique constraint') ||
      message.includes('duplicate key')
    );
  }

  async initiatePackPurchase(params: {
    packId: ReelAiTokenPackId;
    phoneNumber?: string;
    stripePaymentMethod?: 'checkout' | 'payment_sheet';
  }) {
    const user = await this.requireBusinessUser();
    const businessId = user.business!.id as string;
    const pack = getReelAiTokenPack(params.packId);
    if (!pack) throw new BadRequestException('Invalid reel AI token pack');
    const currency = await this.resolveBusinessCurrency(businessId);
    const amount = reelAiPackPriceForCurrency(pack, currency);
    if (amount === null) {
      throw new BadRequestException(
        `Reel AI token packs are not available in ${currency}`
      );
    }
    const rail =
      await this.paymentRoutingService.resolveRailForBusiness(businessId);
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
    return resolveCurrencyFromCountry(country, (query, variables) =>
      this.hasuraSystemService.executeQuery(query, variables)
    );
  }

  private async initiateStripePurchase(params: {
    businessId: string;
    pack: ReelAiTokenPack;
    amount: number;
    currency: string;
    email?: string | null;
    stripePaymentMethod?: 'checkout' | 'payment_sheet';
  }) {
    const description = `AI reel tokens pack ${params.pack.tokens}`;
    if (params.stripePaymentMethod === 'payment_sheet') {
      const intent = await this.stripeCheckoutService.createPaymentIntent({
        amount: params.amount,
        currency: params.currency,
        description,
        paymentEntity: 'reel_ai_token',
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
      paymentEntity: 'reel_ai_token',
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
    pack: ReelAiTokenPack;
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
    const reference = this.buildPaymentReference(params.businessId);
    const provider = this.mobilePaymentsService.getProvider(phone);
    const isMyPVitLike = provider === 'mypvit';
    const providerReference = isMyPVitLike
      ? reference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
      : reference;
    const description = isMyPVitLike
      ? providerReference
      : `AI reel tokens ${params.pack.tokens}`;

    const transaction = await this.mobilePaymentsDatabaseService.createTransaction({
      reference: providerReference,
      amount: params.amount,
      currency: params.currency,
      description,
      provider,
      payment_method: 'mobile_money',
      customer_phone: phone,
      ...(params.email ? { customer_email: params.email } : {}),
      transaction_type: 'PAYMENT',
      payment_entity: 'reel_ai_token',
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
    await this.persistMobileProviderResponse(transaction.id, paymentResponse);

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

  private async persistMobileProviderResponse(
    transactionId: string,
    paymentResponse: {
      success: boolean;
      transactionId?: string;
      message?: string;
      errorCode?: string;
    }
  ): Promise<void> {
    if (paymentResponse.success && paymentResponse.transactionId) {
      await this.mobilePaymentsDatabaseService.updateTransaction(transactionId, {
        transaction_id: paymentResponse.transactionId,
      });
      return;
    }
    if (paymentResponse.success) return;
    await this.mobilePaymentsDatabaseService.updateTransaction(transactionId, {
      status: 'failed',
      error_message: paymentResponse.message,
      error_code: paymentResponse.errorCode,
    });
  }

  private buildPaymentReference(businessId: string): string {
    const nonce = Math.random().toString(36).slice(2, 8);
    return `RAT-${businessId.replace(/-/g, '').slice(0, 8)}-${Date.now()}-${nonce}`;
  }
}
