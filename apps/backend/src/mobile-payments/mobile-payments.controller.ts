import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../accounts/accounts.service';
import { BadRequestException } from '@nestjs/common';
import { isoCountryCode } from '../orders/delivery-pricing.util';
import { validatePhoneNumber } from './phone-validation.util';
import { sanitizeProviderError } from './sanitize-provider-error.util';
import { Public } from '../auth/public.decorator';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { WithdrawalPinService } from '../admin/withdrawal-pin.service';
import {
  GiveChangePayoutService,
  type GiveChangeProvider,
} from './give-change-payout.service';
import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
} from './mobile-payment-callback.dto';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { 
  MobilePaymentsDatabaseService, 
  type MobilePaymentTransaction 
} from './mobile-payments-database.service';
import {
  MobilePaymentsService,
  type MobileTransactionStatus,
} from './mobile-payments.service';
import { MobileTransactionAccessService } from './mobile-transaction-access.service';
import { PendingWithdrawalResolveService } from './pending-withdrawal-resolve.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import {
  MIN_SECRET_REFRESH_TOKEN_LENGTH,
  allowedSecretRefreshIps,
  firstNonEmptyString,
  mypvitSecretName,
  normalizeIp,
  secretRefreshTokenMatches,
} from './secret-refresh-auth';

export const INITIATE_TRANSACTION_TYPES = ['PAYMENT', 'GIVE_CHANGE'] as const;

/**
 * Body of POST /mobile-payments/initiate. A class (not an interface) so the
 * ValidationPipe can reject malformed ids/amounts with a 400 instead of letting
 * them reach Hasura and surface as a 500 (QA L1). Undeclared fields are kept.
 */
export class InitiatePaymentDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  amount!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsOptional()
  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  provider?: 'mypvit' | 'airtel' | 'moov' | 'mtn' | 'orange' | 'freemopay' | 'fedapay';

  @IsOptional()
  @IsString()
  paymentMethod?: 'mobile_money' | 'card' | 'bank_transfer';

  /** Account to top up (PAYMENT) or withdraw from (GIVE_CHANGE). Must be owned by the caller. */
  @IsOptional()
  @IsUUID('all')
  accountId?: string;

  @IsOptional()
  @IsIn(INITIATE_TRANSACTION_TYPES)
  transactionType?: (typeof INITIATE_TRANSACTION_TYPES)[number];

  /** Required when business withdrawals require a PIN */
  @IsOptional()
  @IsString()
  withdrawalPin?: string;
}

export interface PaymentCallbackDto {
  transaction_id: string;
  status: string;
  amount?: number;
  currency?: string;
  reference?: string;
  message?: string;
  signature?: string;
  timestamp?: string;
}

@Controller('mobile-payments')
@Throttle({ short: { limit: 20, ttl: 60000 } })
export class MobilePaymentsController {
  private readonly logger = new Logger(MobilePaymentsController.name);

  constructor(
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly databaseService: MobilePaymentsDatabaseService,
    private readonly accountsService: AccountsService,
    private readonly giveChangePayoutService: GiveChangePayoutService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly callbackProcessor: MobilePaymentCallbackProcessor,
    private readonly withdrawalPinService: WithdrawalPinService,
    private readonly pendingWithdrawalResolveService: PendingWithdrawalResolveService,
    private readonly transactionAccessService: MobileTransactionAccessService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Resolve a pending wallet withdrawal (cancel if never sent, or finalize from provider).
   */
  @Post('withdrawals/:id/resolve')
  async resolvePendingWithdrawal(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Req() req: Request
  ) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      if (!user?.id) {
        throw new HttpException(
          { success: false, message: 'User not found' },
          HttpStatus.UNAUTHORIZED
        );
      }
      return await this.pendingWithdrawalResolveService.resolveForUser(
        id,
        user.id,
        req
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error?.message || 'Failed to resolve withdrawal',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get available payment providers
   * @param country Optional ISO 3166-1 alpha-2 country code to filter providers
   */
  @Get('providers')
  async getProviders(@Query('country') country?: string) {
    try {
      const providers = country
        ? await this.mobilePaymentsService.getProvidersForCountry(country)
        : await this.mobilePaymentsService.getAvailableProviders();
      return {
        success: true,
        data: providers,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get payment providers',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get supported payment methods for a provider
   */
  @Get('providers/:provider/methods')
  async getSupportedMethods(@Param('provider') provider: string) {
    try {
      const methods =
        await this.mobilePaymentsService.getSupportedPaymentMethods(provider);
      return {
        success: true,
        data: methods,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get supported payment methods',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Initiate a mobile payment
   */
  @Post('initiate')
  async initiatePayment(
    @ReqContext() ctx: RequestContext,
    @Body(new ValidationPipe({ transform: true }))
    paymentRequest: InitiatePaymentDto
  ) {
    try {
      if (paymentRequest.transactionType === 'GIVE_CHANGE') {
        return await this.initiateGiveChangeWithdrawal(ctx, paymentRequest);
      }

      // Validate account balance if accountId is provided
      if (paymentRequest.accountId) {
        // QA S1: a top-up (or any non-withdrawal type) into someone else's account was
        // accepted. Same owner/admin gate as GIVE_CHANGE (#511), before any balance read
        // so the response cannot leak another account's existence or balance.
        await this.requireOwnedAccountAccess(ctx, paymentRequest.accountId);
        const accountBalance = await this.accountsService.getAccountBalance(
          paymentRequest.accountId
        );

        if (!accountBalance) {
          throw new HttpException(
            {
              success: false,
              message: 'Account not found',
              error: 'ACCOUNT_NOT_FOUND',
            },
            HttpStatus.BAD_REQUEST
          );
        }

        // Explicitly check for negative balance (applies to all transaction types)
        if (Number(accountBalance.availableBalance) < 0) {
          throw new HttpException(
            {
              success: false,
              message: 'Account balance is negative. Please top up your account before initiating payments.',
              error: 'NEGATIVE_BALANCE',
              data: {
                currentBalance: accountBalance.availableBalance,
                currency: accountBalance.currency,
              },
            },
            HttpStatus.BAD_REQUEST
          );
        }
      }

      const resolvedProvider = await this.mobilePaymentsService.resolveProviderFromRequest(paymentRequest);

      // Check account currency for FedaPay (B5)
      if (paymentRequest.accountId && resolvedProvider === 'fedapay') {
        const accountBalance = await this.accountsService.getAccountBalance(
          paymentRequest.accountId
        );
        if (accountBalance && accountBalance.currency !== 'XOF') {
          throw new HttpException(
            {
              success: false,
              message: 'FedaPay (Togo) requires account currency to be XOF',
              error: 'ACCOUNT_CURRENCY_MISMATCH',
              data: {
                accountCurrency: accountBalance.currency,
                requiredCurrency: 'XOF',
              },
            },
            HttpStatus.BAD_REQUEST
          );
        }
      }

      if (paymentRequest.accountId && paymentRequest.amount < 150) {
        throw new HttpException(
          {
            success: false,
            message: 'Top-up amount must be greater than or equal to 150',
            error: 'MIN_TOP_UP_AMOUNT',
            data: { minAmount: 150, currency: paymentRequest.currency },
          },
          HttpStatus.BAD_REQUEST
        );
      }

      this.assertMobileMoneyCurrency(paymentRequest, resolvedProvider);

      // F-L2, F-M3, F-M6: Validate phone before ANY row creation
      if (paymentRequest.customerPhone) {
        const itemCountry = (paymentRequest as any).itemCountry;
        await this.validatePhoneForPayment(
          paymentRequest.customerPhone,
          resolvedProvider,
          itemCountry
        );
      }

      // Set default callback URL for MyPVIT if not provided
      const callbackUrl =
        paymentRequest.callbackUrl ||
        `${
          process.env.API_BASE_URL || 'http://localhost:3000'
        }/mobile-payments/callback/pvit`;

      // Generate a unique reference for the transaction (same format as MyPVIT service)
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.random().toString(36).substr(2, 4);
      const reference = `P${timestamp}${random}`;

      // Create transaction record in database
      const transaction = await this.databaseService.createTransaction({
        reference: reference,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        description: paymentRequest.description,
        provider: await resolvedProvider,
        payment_method: paymentRequest.paymentMethod || 'mobile_money',
        customer_phone: paymentRequest.customerPhone,
        customer_email: paymentRequest.customerEmail,
        account_id: paymentRequest.accountId,
        transaction_type: paymentRequest.transactionType || 'PAYMENT',
      });

      // Get the current user's ID for MTN payments
      let userId: string | undefined;
      try {
        const user = await this.hasuraUserService.getUser(ctx);
        userId = user.id;
      } catch {
        // User may not be authenticated or may not exist yet
        // This is okay for non-MTN providers, but MTN will need userId
        this.logger.warn('Could not get user ID for payment initiation');
      }

      // Initiate payment with provider
      const paymentResponse = await this.mobilePaymentsService.initiatePayment(
        {
          ...paymentRequest,
          callbackUrl,
        },
        reference,
        userId
      );

      // Update transaction with provider response
      if (paymentResponse.success && paymentResponse.transactionId) {
        await this.databaseService.updateTransaction(transaction.id, {
          transaction_id: paymentResponse.transactionId,
        });
        
        // G2: Schedule mock callback AFTER persisting the transaction_id
        if (paymentResponse.transactionId.startsWith('mock-')) {
          await this.mobilePaymentsService.scheduleMockCallback(
            paymentResponse.transactionId,
            reference
          );
        }
      } else {
        await this.databaseService.updateTransaction(transaction.id, {
          status: 'failed',
          error_message: paymentResponse.message,
          error_code: paymentResponse.errorCode,
        });
      }

      return {
        success: paymentResponse.success,
        data: {
          transactionId: transaction.id,
          providerTransactionId: paymentResponse.transactionId,
          paymentUrl: paymentResponse.paymentUrl,
          message: paymentResponse.message,
          provider: paymentResponse.provider,
          ...(paymentResponse.reason ? { status: paymentResponse.status, reason: paymentResponse.reason } : {}),
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Never echo raw provider/Hasura errors (they can include query text): QA L1.
      this.logger.error(`initiate_payment_failed: ${error?.message}`);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to initiate payment',
          error: 'PAYMENT_INITIATION_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Check transaction status
   */
  @Get('transactions/:transactionId/status')
  async checkTransactionStatus(
    @Param('transactionId') transactionId: string,
    @ReqContext() ctx: RequestContext,
    @Query('provider') provider?: string
  ) {
    try {
      await this.loadViewableTransactionById(transactionId, ctx);
      const status = await this.mobilePaymentsService.checkTransactionStatus(
        transactionId,
        provider
      );
      await this.persistPolledStatus(transactionId, status);
      return { success: true, data: status };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to check transaction status',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Cancel a pending or processing transaction (CAS to prevent cancel after SUCCESS)
   */
  @Post('transactions/:transactionId/cancel')
  async cancelTransaction(
    @Param('transactionId') transactionId: string,
    @ReqContext() ctx: RequestContext,
    @Query('provider') provider?: string
  ) {
    try {
      const transaction = await this.loadViewableTransactionById(transactionId, ctx);
      
      // Only cancel if pending (processing means wallet already credited or payout sent)
      if (transaction.status !== 'pending') {
        return {
          success: false,
          message: `Cannot cancel: transaction is already ${transaction.status}`,
        };
      }
      
      const success = await this.mobilePaymentsService.cancelTransaction(
        transactionId,
        provider
      );
      if (success) {
        // Use CAS to only cancel if still pending
        const cancelled = await this.databaseService.updateTransactionIfStatus(
          transactionId,
          'pending',
          { status: 'cancelled' }
        );
        if (!cancelled) {
          return {
            success: false,
            message: 'Transaction status changed before cancel could complete',
          };
        }
      }
      return {
        success,
        message: success
          ? 'Transaction cancelled successfully'
          : 'Failed to cancel transaction',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to cancel transaction',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get transaction by ID
   */
  @Get('transactions/:transactionId')
  async getTransaction(
    @Param('transactionId') transactionId: string,
    @ReqContext() ctx: RequestContext
  ) {
    try {
      const transaction = await this.loadViewableTransactionById(
        transactionId,
        ctx
      );
      return { success: true, data: transaction };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get transaction',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get transaction by reference
   */
  @Get('transactions/reference/:reference')
  async getTransactionByReference(
    @Param('reference') reference: string,
    @ReqContext() ctx: RequestContext
  ) {
    try {
      const user = await this.hasuraUserService.getUser(ctx);
      const transaction = await this.databaseService.getTransactionByReference(
        reference
      );
      await this.requireViewableTransaction(transaction, user?.id);
      return { success: true, data: transaction };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get transaction',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get transaction history (mobile-payments admin only).
   */
  @Get('transactions')
  async getTransactions(
    @ReqContext() ctx: RequestContext,
    @Query('provider') provider?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    try {
      await this.requireMobilePaymentsAdmin(ctx);
      const transactions = await this.databaseService.getTransactions({
        provider,
        status,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      return { success: true, data: transactions };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get transactions',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get transaction statistics (mobile-payments admin only).
   */
  @Get('statistics')
  async getStatistics(
    @ReqContext() ctx: RequestContext,
    @Query('provider') provider?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      await this.requireMobilePaymentsAdmin(ctx);
      const stats = await this.databaseService.getTransactionStats({
        provider,
        startDate,
        endDate,
      });
      return { success: true, data: stats };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get statistics',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Payment callback endpoint for MyPVIT.
   *
   * On success, credits the transaction account then finalizes the payment entity (e.g. orders).
   * Pay-at-delivery orders: funds are credited to the client wallet, then settled to business and
   * delivery parties via OrdersService without placing client holds.
   */
  @Public()
  @Post('callback/mypvit')
  async mypvitCallback(
    @Body() callbackData: MyPVitCallbackDto,
    @Req() req: Request
  ) {
    try {
      if (
        !callbackData.transactionId ||
        !callbackData.merchantReferenceId ||
        !callbackData.status
      ) {
        throw new HttpException(
          {
            success: false,
            message: 'Missing required callback data',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return await this.callbackProcessor.processMypvitCallback(callbackData, req);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`MyPVIT callback processing error: ${sanitized.message}`);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to process callback',
          error: sanitized.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Payment callback endpoint for Freemopay (Cameroon).
   *
   * On success, credits the transaction account then finalizes the payment entity (e.g. orders).
   * Pay-at-delivery orders: funds are credited to the client wallet, then settled to business and
   * delivery parties via OrdersService without placing client holds.
   */
  @Public()
  @Post('callback/freemopay')
  async freemopayCallback(
    @Body() callbackData: FreemopayCallbackDto,
    @Req() req: Request
  ) {
    this.logger.log('freemopayCallback', callbackData);
    try {
      if (!callbackData.reference || !callbackData.status) {
        this.logger.error(
          'Missing required callback data (reference, status)'
        );
        throw new HttpException(
          {
            success: false,
            message: 'Missing required callback data (reference, status)',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return await this.callbackProcessor.processFreemopayCallback(
        callbackData,
        req
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Freemopay callback processing error: ${sanitized.message}`);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to process callback',
          error: sanitized.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Post('callback/fedapay')
  async fedapayCallback(
    @Req() req: Request
  ) {
    try {
      const signature = req.headers['x-fedapay-signature'] as string;
      const rawBody = (req as unknown as { body: Buffer }).body;
      
      if (!signature) {
        this.logger.warn('FedaPay webhook rejected: missing signature header');
        throw new HttpException(
          {
            success: false,
            message: 'Missing webhook signature',
          },
          HttpStatus.UNAUTHORIZED
        );
      }

      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        this.logger.warn('FedaPay webhook rejected: raw body unavailable');
        throw new HttpException(
          {
            success: false,
            message: 'Invalid request body',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const callbackData = this.verifyAndParseFedaPayWebhook(rawBody, signature);

      if (!callbackData.entity || !callbackData.name) {
        this.logger.warn('FedaPay webhook rejected: missing entity or name');
        throw new HttpException(
          {
            success: false,
            message: 'Missing required callback data',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(`FedaPay webhook: event=${callbackData.name} entity_id=${callbackData.entity.id}`);

      const result = await this.callbackProcessor.processFedaPayCallback(
        callbackData,
        req
      );
      
      // B2: Record replay cache only after successful processing
      const eventId = callbackData.entity?.id ? String(callbackData.entity.id) : null;
      const timestamp = (callbackData as any).webhookTimestamp || Math.floor(Date.now() / 1000);
      if (eventId) {
        this.recordFedaPayEvent(eventId, String(timestamp));
      }
      
      return result;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`FedaPay callback processing error: ${sanitized.message}`);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to process FedaPay callback',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private verifyAndParseFedaPayWebhook(rawBody: Buffer, signatureHeader: string): any {
    const webhookSecret = this.configService.get<string>('fedapay.webhookSecret');
    
    if (!webhookSecret) {
      this.logger.error('FedaPay webhook secret not configured');
      throw new HttpException(
        {
          success: false,
          message: 'Webhook verification not configured',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    let event: any;
    let timestamp: number;
    try {
      const { Webhook } = require('fedapay');
      event = Webhook.constructEvent(
        rawBody.toString('utf8'),
        signatureHeader,
        webhookSecret
      );
      
      const parts = signatureHeader.split(',');
      let timestampStr: string | null = null;
      for (const part of parts) {
        const [key, value] = part.trim().split('=');
        if (key === 't') timestampStr = value;
      }
      timestamp = timestampStr ? parseInt(timestampStr, 10) : Math.floor(Date.now() / 1000);
    } catch (error: any) {
      this.logger.warn(`FedaPay webhook rejected: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: 'Invalid webhook signature',
        },
        HttpStatus.UNAUTHORIZED
      );
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - timestamp);
    
    if (timeDiff > 300) {
      this.logger.warn(`FedaPay webhook rejected: stale timestamp (diff=${timeDiff}s)`);
      throw new HttpException(
        {
          success: false,
          message: 'Webhook timestamp too old or in future',
        },
        HttpStatus.UNAUTHORIZED
      );
    }
    
    const eventId = event.entity?.id ? String(event.entity.id) : null;
    const timestampStr = String(timestamp);
    if (eventId && this.hasSeenFedaPayEvent(eventId, timestampStr)) {
      this.logger.log(`FedaPay webhook: duplicate event_id=${eventId}, returning 200`);
      throw new HttpException(
        {
          success: true,
          message: 'Duplicate event',
        },
        HttpStatus.OK
      );
    }
    
    // B2: Do NOT record yet - must wait for processing to succeed
    // Recording happens after processFedaPayCallback succeeds
    // Attach timestamp to event for later use
    (event as any).webhookTimestamp = timestamp;
    
    return event;
  }

  private fedapayEventCache = new Map<string, number>();
  
  private hasSeenFedaPayEvent(eventId: string, timestamp: string): boolean {
    const key = `${eventId}:${timestamp}`;
    return this.fedapayEventCache.has(key);
  }
  
  private recordFedaPayEvent(eventId: string, timestamp: string): void {
    const key = `${eventId}:${timestamp}`;
    const timestampNum = parseInt(timestamp, 10);
    this.fedapayEventCache.set(key, timestampNum);
    
    const cutoff = Math.floor(Date.now() / 1000) - 600;
    for (const [cachedKey, cachedTime] of this.fedapayEventCache.entries()) {
      if (cachedTime < cutoff) {
        this.fedapayEventCache.delete(cachedKey);
      }
    }
  }

  /**
   * Check merchant balance
   */
  @Get('balance')
  async checkBalance(@Query('provider') provider?: string) {
    try {
      const balance = await this.mobilePaymentsService.checkBalance(provider);
      return {
        success: true,
        data: balance,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to check balance',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * MyPVit secret reception webhook ("URL de réception de clé secrète").
   *
   * Overwrites the live MyPVit operation-account secret, so it fails closed:
   * - the URL must carry MYPVIT_SECRET_REFRESH_TOKEN as its last path segment (MyPVit
   *   documents no signature or custom header for this call); constant-time compare;
   * - the caller must be one of MyPVit's documented IPs (MYPVIT_SECRET_REFRESH_ALLOWED_IPS
   *   overrides the list);
   * - the Airtel/Moov operation account codes must be configured (no hard-coded fallback);
   * - the response echoes nothing about the secret store.
   * Validation failures are 4xx; secret values are never logged.
   */
  @Public()
  @Post('secret-refresh/:token')
  @HttpCode(HttpStatus.OK)
  async handleSecretRefreshCallback(
    @Param('token') token: string,
    @Body()
    webhookData: {
      merchant_operation_account_code?: string;
      operation_account_code?: string;
      secret_key?: string;
      secret?: string;
      expires_in?: number;
    },
    @Req() req: Request
  ) {
    this.assertSecretRefreshAuthorized(token, req);

    // docs.mypvit.pro documents `secret` / `operation_account_code` (SyncSecretKeyResponse);
    // the long-standing handler read `secret_key` / `merchant_operation_account_code`. The
    // first non-empty string of each pair wins, so either shape (or both) is accepted.
    const secret = firstNonEmptyString(webhookData?.secret, webhookData?.secret_key);
    const accountCode = firstNonEmptyString(
      webhookData?.operation_account_code,
      webhookData?.merchant_operation_account_code
    );
    if (secret === undefined || secret.length > 512) {
      throw new HttpException(
        { success: false, message: 'Invalid secret refresh payload' },
        HttpStatus.BAD_REQUEST
      );
    }
    if (accountCode === undefined) {
      throw new HttpException(
        { success: false, message: 'Invalid secret refresh payload' },
        HttpStatus.BAD_REQUEST
      );
    }

    const airtelAccountCode =
      process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE?.trim();
    const moovAccountCode = process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE?.trim();
    if (!airtelAccountCode || !moovAccountCode) {
      this.logger.error(
        'MyPVit secret refresh rejected: Airtel/Moov operation account codes are not configured'
      );
      throw new HttpException(
        { success: false, message: 'Secret refresh is not available' },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    // QA #593 R1: identical codes = one account, one secret: store it under both names
    // (one atomic Secrets Manager write). Production refuses to boot with identical codes.
    let secretKeyNames: Array<'AIRTEL_MYPVIT_SECRET_KEY' | 'MOOV_MYPVIT_SECRET_KEY'>;
    if (accountCode === airtelAccountCode && accountCode === moovAccountCode) {
      secretKeyNames = ['AIRTEL_MYPVIT_SECRET_KEY', 'MOOV_MYPVIT_SECRET_KEY'];
    } else if (accountCode === airtelAccountCode) {
      secretKeyNames = ['AIRTEL_MYPVIT_SECRET_KEY'];
    } else if (accountCode === moovAccountCode) {
      secretKeyNames = ['MOOV_MYPVIT_SECRET_KEY'];
    } else {
      this.logger.warn('MyPVit secret refresh rejected: unknown operation account code');
      throw new HttpException(
        { success: false, message: 'Invalid secret refresh payload' },
        HttpStatus.BAD_REQUEST
      );
    }

    const [primaryKey, ...alsoKeys] = secretKeyNames;
    const keysLabel = secretKeyNames.join(' and ');
    try {
      if (alsoKeys.length > 0) {
        // One write: the extra names ride in the same merged SecretString.
        await this.mobilePaymentsService.updateSecretInSecretsManager(
          mypvitSecretName(),
          primaryKey,
          secret,
          Object.fromEntries(alsoKeys.map((k) => [k, secret]))
        );
      } else {
        await this.mobilePaymentsService.updateSecretInSecretsManager(mypvitSecretName(), primaryKey, secret);
      }
    } catch (error: unknown) {
      // Name only: the message can quote the secret store (JSON.parse) or the request.
      const name = (error as { name?: string } | null)?.name || 'Error';
      this.logger.error(`MyPVit secret refresh failed to store ${keysLabel}: ${name}`);
      throw new HttpException(
        { success: false, message: 'Failed to handle secret refresh webhook' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    this.logger.log(`MyPVit secret refresh stored ${keysLabel}`);
    return { success: true, data: { updated_at: new Date().toISOString() } };
  }

  /** Old unauthenticated URL: always refused, so a stale registration fails closed. */
  @Public()
  @Post('secret-refresh')
  rejectUnauthenticatedSecretRefresh(@Req() req: Request): never {
    this.logger.warn(
      `MyPVit secret refresh rejected: no token in URL (ip=${normalizeIp(req?.ip)})`
    );
    throw new HttpException({ success: false, message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
  }

  /**
   * QA #593 S4: one response for every authentication failure, decided in a constant order.
   * The IP check and the token compare both always run (no short-circuit), and an
   * unconfigured token, a non-allow-listed IP and a wrong token all get the same 401 body, so
   * a caller learns nothing about which check failed (or whether the endpoint is configured).
   * The reason goes to the log only.
   */
  private assertSecretRefreshAuthorized(token: string | undefined, req: Request): void {
    const expected = process.env.MYPVIT_SECRET_REFRESH_TOKEN?.trim() ?? '';
    const configured = expected.length >= MIN_SECRET_REFRESH_TOKEN_LENGTH;
    const ip = normalizeIp(req?.ip);
    const allowed = allowedSecretRefreshIps(process.env.MYPVIT_SECRET_REFRESH_ALLOWED_IPS);
    const ipAllowed = allowed.includes(ip);
    // Always compare (against a dummy when unconfigured) so timing doesn't reveal the state.
    const tokenOk = secretRefreshTokenMatches(
      token,
      configured ? expected : 'x'.repeat(MIN_SECRET_REFRESH_TOKEN_LENGTH)
    );
    if (configured && ipAllowed && tokenOk) return;

    if (!configured) {
      this.logger.error(
        'MyPVit secret refresh rejected: MYPVIT_SECRET_REFRESH_TOKEN is not configured'
      );
    } else {
      const reasons = [!ipAllowed ? 'ip not allow-listed' : '', !tokenOk ? 'bad token' : '']
        .filter(Boolean)
        .join(', ');
      this.logger.warn(`MyPVit secret refresh rejected: ${reasons} (ip=${ip})`);
    }
    throw new HttpException({ success: false, message: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
  }

  /**
   * Perform KYC verification
   */
  @Post('kyc')
  async performKYC(
    @Body()
    kycData: {
      customerPhone: string;
      customerName: string;
      customerId?: string;
      customerEmail?: string;
    },
    @Query('provider') provider?: string
  ) {
    try {
      const result = await this.mobilePaymentsService.performKYC(
        kycData,
        provider
      );
      return {
        success: result.success,
        data: {
          kycStatus: result.kycStatus,
          message: result.message,
        },
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to perform KYC',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  async healthCheck() {
    try {
      const providers =
        await this.mobilePaymentsService.getAvailableProviders();
      const availableProviders = providers.filter((p) => p.isAvailable);

      return {
        success: true,
        data: {
          status: 'healthy',
          availableProviders: availableProviders.length,
          totalProviders: providers.length,
          providers: availableProviders.map((p) => p.name),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        data: {
          status: 'unhealthy',
          error: error.message,
        },
      };
    }
  }

  private async loadViewableTransactionById(
    transactionId: string,
    ctx: RequestContext
  ): Promise<MobilePaymentTransaction> {
    const user = await this.hasuraUserService.getUser(ctx);
    const transaction = await this.databaseService.getTransactionById(
      transactionId
    );
    return await this.requireViewableTransaction(transaction, user?.id);
  }

  private async requireViewableTransaction<
    T extends { account_id?: string | null }
  >(transaction: T | null, userId: string | null | undefined): Promise<T> {
    if (
      !transaction ||
      !(await this.transactionAccessService.canView(transaction, userId))
    ) {
      throw new HttpException(
        { success: false, message: 'Transaction not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return transaction;
  }

  private async requireMobilePaymentsAdmin(ctx: RequestContext): Promise<void> {
    const user = await this.hasuraUserService.getUser(ctx);
    if (!(await this.transactionAccessService.canAdminister(user?.id))) {
      throw new HttpException(
        { success: false, message: 'Forbidden' },
        HttpStatus.FORBIDDEN
      );
    }
  }

  /**
   * Wallet withdrawals must never fall through to the collection initiate path.
   * Without an owned account, FreemoPay/MyPVit GIVE_CHANGE pays the platform merchant.
   */
  private async initiateGiveChangeWithdrawal(
    ctx: RequestContext,
    request: InitiatePaymentDto
  ) {
    const accountId = this.requireGiveChangeAccountId(request);
    const initiatorUserId = await this.requireOwnedAccountAccess(
      ctx,
      accountId
    );
    await this.assertGiveChangePrechecks(request, accountId);
    const resolvedProvider = await this.mobilePaymentsService.resolveProviderFromRequest(request);
    
    // Check account currency for FedaPay withdrawals (B5)
    if (resolvedProvider === 'fedapay') {
      const accountBalance = await this.accountsService.getAccountBalance(accountId);
      if (accountBalance && accountBalance.currency !== 'XOF') {
        throw new HttpException(
          {
            success: false,
            message: 'FedaPay (Togo) withdrawals require account currency to be XOF',
            error: 'ACCOUNT_CURRENCY_MISMATCH',
            data: {
              accountCurrency: accountBalance.currency,
              requiredCurrency: 'XOF',
            },
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }
    
    this.assertMobileMoneyCurrency(request, resolvedProvider);
    return this.executeOwnedGiveChangePayout(
      request,
      accountId,
      resolvedProvider,
      initiatorUserId
    );
  }

  private requireGiveChangeAccountId(request: InitiatePaymentDto): string {
    const accountId = request.accountId?.trim();
    if (!accountId) {
      throw new HttpException(
        {
          success: false,
          message: 'Account is required for withdrawals',
          error: 'ACCOUNT_REQUIRED',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return accountId;
  }

  private async requireOwnedAccountAccess(
    ctx: RequestContext,
    accountId: string
  ): Promise<string> {
    const userId = await this.requireInitiateUserId(ctx);
    const allowed = await this.transactionAccessService.canView(
      { account_id: accountId },
      userId
    );
    if (!allowed) {
      throw new HttpException(
        { success: false, message: 'Account not found', error: 'ACCOUNT_NOT_FOUND' },
        HttpStatus.NOT_FOUND
      );
    }
    return userId;
  }

  private async requireInitiateUserId(ctx: RequestContext): Promise<string> {
    try {
      const userId = (await this.hasuraUserService.getUser(ctx))?.id;
      if (userId) return userId;
    } catch {
      // fail closed — never payout without a resolved caller
    }
    throw new HttpException(
      { success: false, message: 'User not found', error: 'UNAUTHORIZED' },
      HttpStatus.UNAUTHORIZED
    );
  }

  private async assertGiveChangePrechecks(
    request: InitiatePaymentDto,
    accountId: string
  ): Promise<void> {
    await this.assertGiveChangeAmountAndPhone(request);
    await this.assertGiveChangeFunds(request, accountId);
    await this.assertGiveChangePin(request, accountId);
  }

  private async assertGiveChangeAmountAndPhone(request: InitiatePaymentDto): Promise<void> {
    if (request.amount < 150) {
      throw new HttpException(
        {
          success: false,
          message: 'Withdrawal amount must be greater than or equal to 150',
          error: 'MIN_WITHDRAW_AMOUNT',
          data: { minAmount: 150, currency: request.currency },
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const isValidDestination = await this.mobilePaymentsService.isWithdrawalDestinationCmOrGa(
      request.customerPhone
    );
    if (!isValidDestination) {
      throw new HttpException(
        {
          success: false,
          message:
            'Withdrawals are only supported to Cameroon (+237), Gabon (+241), or Togo (+228) mobile numbers (when active)',
          error: 'WITHDRAW_PHONE_REGION_NOT_ALLOWED',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async assertGiveChangeFunds(
    request: InitiatePaymentDto,
    accountId: string
  ): Promise<void> {
    const balance = await this.accountsService.getAccountBalance(accountId);
    if (!balance) {
      throw new HttpException(
        { success: false, message: 'Account not found', error: 'ACCOUNT_NOT_FOUND' },
        HttpStatus.BAD_REQUEST
      );
    }
    this.assertGiveChangeBalance(request, balance);
  }

  private assertGiveChangeBalance(
    request: InitiatePaymentDto,
    balance: { availableBalance: number; currency: string }
  ): void {
    if (Number(balance.availableBalance) < 0) {
      throw new HttpException(
        {
          success: false,
          message:
            'Account balance is negative. Please top up your account before initiating payments.',
          error: 'NEGATIVE_BALANCE',
          data: {
            currentBalance: balance.availableBalance,
            currency: balance.currency,
          },
        },
        HttpStatus.BAD_REQUEST
      );
    }
    if (balance.availableBalance < request.amount) {
      throw new HttpException(
        {
          success: false,
          message: 'Insufficient funds',
          error: 'INSUFFICIENT_FUNDS',
          data: {
            required: request.amount,
            available: balance.availableBalance,
            currency: request.currency,
          },
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async assertGiveChangePin(
    request: InitiatePaymentDto,
    accountId: string
  ): Promise<void> {
    const pinState =
      await this.accountsService.getBusinessWithdrawalPinStateByAccountId(
        accountId
      );
    if (!pinState?.enabled) return;
    const providedPin = String(request.withdrawalPin ?? '').trim();
    if (!/^\d{4}$/.test(providedPin) || !pinState.hash) {
      throw new HttpException(
        {
          success: false,
          message: 'Withdrawal PIN is required',
          error: 'WITHDRAWAL_PIN_REQUIRED',
        },
        HttpStatus.FORBIDDEN
      );
    }
    const ok = this.withdrawalPinService.verifyPin(
      pinState.businessId,
      providedPin,
      pinState.hash
    );
    if (!ok) {
      throw new HttpException(
        {
          success: false,
          message: 'Invalid withdrawal PIN',
          error: 'INVALID_WITHDRAWAL_PIN',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  /**
   * F-L2, F-M3, F-M6: Validate phone number against provider and market BEFORE creating any row.
   * Returns 400 BadRequestException on validation failure.
   */
  private async validatePhoneForPayment(
    customerPhone: string,
    provider: string,
    itemCountry?: string
  ): Promise<void> {
    // Derive region from resolved provider for accurate phone parsing
    const providerRegionMap: Record<string, string> = {
      fedapay: 'TG',
      freemopay: 'CM',
      mypvit: 'GA',
      airtel: 'GA',
      moov: 'GA',
    };
    const region = providerRegionMap[provider] || 'GA';
    const phoneValidation = validatePhoneNumber(customerPhone, region);
    
    if (!phoneValidation.isValid) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid phone number format',
        error: 'INVALID_PHONE_NUMBER',
      });
    }

    const phoneCountry = phoneValidation.regionCode;

    // F-M3 & F-M6: Phone country must match item/market country (bidirectional)
    // This check MUST run before provider-specific checks so that country mismatches
    // are reported as PHONE_COUNTRY_MISMATCH rather than generic INVALID_PHONE_NUMBER
    if (itemCountry) {
      // Normalize item country to ISO (handles "Togo", "TOGO", "TG", etc.)
      const normalizedItemCountry = isoCountryCode(itemCountry);
      if (normalizedItemCountry && phoneCountry !== normalizedItemCountry) {
        throw new BadRequestException({
          success: false,
          message: `Payment phone number must match the item's country (${normalizedItemCountry})`,
          error: 'PHONE_COUNTRY_MISMATCH',
          data: {
            phoneCountry,
            itemCountry: normalizedItemCountry,
          },
        });
      }
    }

    // F-L2: FedaPay requires Togo phone
    if (provider === 'fedapay' && phoneCountry !== 'TG') {
      throw new BadRequestException({
        success: false,
        message: 'FedaPay requires a Togo (+228) phone number',
        error: 'INVALID_PHONE_NUMBER',
      });
    }

    // F-M6: Provider-specific country validation
    // Freemopay -> CM only
    if (provider === 'freemopay' && phoneCountry !== 'CM') {
      throw new BadRequestException({
        success: false,
        message: 'Freemopay requires a Cameroon (+237) phone number',
        error: 'INVALID_PHONE_NUMBER',
      });
    }
    // MyPVit/Airtel/Moov -> GA only
    if (['mypvit', 'airtel', 'moov'].includes(provider) && phoneCountry !== 'GA') {
      throw new BadRequestException({
        success: false,
        message: `${provider} requires a Gabon (+241) phone number`,
        error: 'INVALID_PHONE_NUMBER',
      });
    }
  }

  private assertMobileMoneyCurrency(
    request: InitiatePaymentDto,
    resolvedProvider: string
  ): void {
    // FedaPay checks apply regardless of paymentMethod (B5)
    if (resolvedProvider === 'fedapay') {
      // Reject non-mobile_money for fedapay
      const isMobileMoney = !request.paymentMethod || request.paymentMethod === 'mobile_money';
      if (!isMobileMoney) {
        throw new HttpException(
          {
            success: false,
            message: 'FedaPay only supports mobile_money payment method',
            error: 'UNSUPPORTED_PAYMENT_METHOD',
            data: {
              provider: resolvedProvider,
              paymentMethod: request.paymentMethod,
            },
          },
          HttpStatus.BAD_REQUEST
        );
      }
      
      if (request.currency !== 'XOF') {
        throw new HttpException(
          {
            success: false,
            message: 'FedaPay payments are only supported for XOF currency',
            error: 'UNSUPPORTED_CURRENCY',
            data: {
              provider: resolvedProvider,
              currency: request.currency,
              supportedCurrency: 'XOF',
            },
          },
          HttpStatus.BAD_REQUEST
        );
      }
      if (!Number.isInteger(request.amount)) {
        throw new HttpException(
          {
            success: false,
            message: 'FedaPay amounts must be integers (XOF has no decimals)',
            error: 'INVALID_AMOUNT',
            data: {
              provider: resolvedProvider,
              amount: request.amount,
            },
          },
          HttpStatus.BAD_REQUEST
        );
      }
      return;
    }
    
    // Other providers only for mobile_money
    const isMobileMoney =
      !request.paymentMethod || request.paymentMethod === 'mobile_money';
    
    if (!isMobileMoney) {
      return;
    }

    if (
      request.currency === 'XAF' ||
      (resolvedProvider !== 'mypvit' &&
        resolvedProvider !== 'freemopay' &&
        resolvedProvider !== 'mtn' &&
        resolvedProvider !== 'orange')
    ) {
      return;
    }
    
    throw new HttpException(
      {
        success: false,
        message: 'Mobile money payments are only supported for XAF currency',
        error: 'UNSUPPORTED_CURRENCY',
        data: {
          provider: resolvedProvider,
          currency: request.currency,
          supportedCurrency: 'XAF',
        },
      },
      HttpStatus.BAD_REQUEST
    );
  }

  private async executeOwnedGiveChangePayout(
    request: InitiatePaymentDto,
    accountId: string,
    resolvedProvider: string,
    initiatorUserId: string
  ) {
    const result = await this.giveChangePayoutService.executeGiveChangePayout(
      {
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        customerPhone: request.customerPhone ?? '',
        accountId,
        provider: resolvedProvider as GiveChangeProvider,
        paymentMethod: request.paymentMethod,
        callbackUrl: request.callbackUrl,
        withdrawalMemoPrefix: 'Mobile payment give change',
      },
      { throwOnWithdrawalFailure: true, initiatorUserId }
    );
    return {
      success: result.success,
      data: {
        transactionId: result.data?.transactionId ?? '',
        providerTransactionId: result.data?.providerTransactionId,
        paymentUrl: result.data?.paymentUrl,
        message: result.data?.message,
        provider: result.data?.provider,
        ...(result.data?.reason ? { status: result.data.status, reason: result.data.reason } : {}),
        ...(result.data?.error ? { error: result.data.error } : {}),
      },
    };
  }

  private async persistPolledStatus(
    transactionId: string,
    status: Pick<MobileTransactionStatus, 'status' | 'message'>
  ): Promise<void> {
    // ambiguous / refunded never change the row from a poll (refunded needs manual review).
    const persistedStatus =
      status.status === 'ambiguous' || status.status === 'refunded' ? 'pending' : status.status;
    await this.databaseService.updateTransaction(transactionId, {
      status: persistedStatus,
      error_message: status.message,
    });
  }
}
