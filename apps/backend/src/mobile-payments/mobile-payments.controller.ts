import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountsService } from '../accounts/accounts.service';
import { Public } from '../auth/public.decorator';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  GiveChangePayoutService,
  type GiveChangeProvider,
} from './give-change-payout.service';
import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
} from './mobile-payment-callback.dto';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsService } from './mobile-payments.service';

export interface InitiatePaymentDto {
  amount: number;
  currency: string;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
  callbackUrl?: string;
  returnUrl?: string;
  provider?: 'mypvit' | 'airtel' | 'moov' | 'mtn' | 'freemopay';
  paymentMethod?: 'mobile_money' | 'card' | 'bank_transfer';
  accountId?: string; // Account ID for top-up operations
  transactionType?: 'PAYMENT' | 'GIVE_CHANGE'; // Transaction type for mobile payments
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
    private readonly callbackProcessor: MobilePaymentCallbackProcessor
  ) {}

  /**
   * Get available payment providers
   */
  @Get('providers')
  async getProviders() {
    try {
      const providers =
        await this.mobilePaymentsService.getAvailableProviders();
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
  async initiatePayment(@Body() paymentRequest: InitiatePaymentDto) {
    try {
      // Validate account balance if accountId is provided
      if (paymentRequest.accountId) {
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

        // Validate sufficient funds for GIVE_CHANGE transactions
        if (paymentRequest.transactionType === 'GIVE_CHANGE') {
          if (accountBalance.availableBalance < paymentRequest.amount) {
            throw new HttpException(
              {
                success: false,
                message: 'Insufficient funds',
                error: 'INSUFFICIENT_FUNDS',
                data: {
                  required: paymentRequest.amount,
                  available: accountBalance.availableBalance,
                  currency: paymentRequest.currency,
                },
              },
              HttpStatus.BAD_REQUEST
            );
          }
        }
      }

      const resolvedProvider =
        this.mobilePaymentsService.resolveProviderFromRequest(paymentRequest);

      const isAccountTopUpPayment =
        !!paymentRequest.accountId &&
        paymentRequest.transactionType !== 'GIVE_CHANGE';

      if (isAccountTopUpPayment && paymentRequest.amount < 150) {
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

      const isAccountWithdrawal =
        !!paymentRequest.accountId &&
        paymentRequest.transactionType === 'GIVE_CHANGE';

      if (isAccountWithdrawal) {
        if (paymentRequest.amount < 150) {
          throw new HttpException(
            {
              success: false,
              message:
                'Withdrawal amount must be greater than or equal to 150',
              error: 'MIN_WITHDRAW_AMOUNT',
              data: {
                minAmount: 150,
                currency: paymentRequest.currency,
              },
            },
            HttpStatus.BAD_REQUEST
          );
        }
        if (
          !this.mobilePaymentsService.isWithdrawalDestinationCmOrGa(
            paymentRequest.customerPhone
          )
        ) {
          throw new HttpException(
            {
              success: false,
              message:
                'Withdrawals are only supported to Cameroon (+237) or Gabon (+241) mobile numbers',
              error: 'WITHDRAW_PHONE_REGION_NOT_ALLOWED',
            },
            HttpStatus.BAD_REQUEST
          );
        }
      }

      const isMobileMoney =
        !paymentRequest.paymentMethod ||
        paymentRequest.paymentMethod === 'mobile_money';

      if (
        isMobileMoney &&
        paymentRequest.currency !== 'XAF' &&
        (resolvedProvider === 'mypvit' || resolvedProvider === 'freemopay')
      ) {
        throw new HttpException(
          {
            success: false,
            message:
              'Mobile money payments are only supported for XAF currency',
            error: 'UNSUPPORTED_CURRENCY',
            data: {
              provider: resolvedProvider,
              currency: paymentRequest.currency,
              supportedCurrency: 'XAF',
            },
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const isGiveChange =
        paymentRequest.transactionType === 'GIVE_CHANGE' &&
        !!paymentRequest.accountId;

      if (isGiveChange) {
        const accountId = paymentRequest.accountId as string;
        let initiatorUserId: string | undefined;
        try {
          const user = await this.hasuraUserService.getUser();
          initiatorUserId = user.id;
        } catch {
          this.logger.warn('Could not get user ID for payment initiation');
        }
        const result =
          await this.giveChangePayoutService.executeGiveChangePayout(
            {
              amount: paymentRequest.amount,
              currency: paymentRequest.currency,
              description: paymentRequest.description,
              customerPhone: paymentRequest.customerPhone ?? '',
              accountId,
              provider: resolvedProvider as GiveChangeProvider,
              paymentMethod: paymentRequest.paymentMethod,
              callbackUrl: paymentRequest.callbackUrl,
              withdrawalMemoPrefix: 'Mobile payment give change',
            },
            {
              throwOnWithdrawalFailure: true,
              initiatorUserId,
            }
          );
        return {
          success: result.success,
          data: {
            transactionId: result.data?.transactionId ?? '',
            providerTransactionId: result.data?.providerTransactionId,
            paymentUrl: result.data?.paymentUrl,
            message: result.data?.message,
            provider: result.data?.provider,
          },
        };
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
        provider: resolvedProvider,
        payment_method: paymentRequest.paymentMethod || 'mobile_money',
        customer_phone: paymentRequest.customerPhone,
        customer_email: paymentRequest.customerEmail,
        account_id: paymentRequest.accountId,
        transaction_type: paymentRequest.transactionType || 'PAYMENT',
      });

      // Get the current user's ID for MTN payments
      let userId: string | undefined;
      try {
        const user = await this.hasuraUserService.getUser();
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
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to initiate payment',
          error: error.message,
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
    @Query('provider') provider?: string
  ) {
    try {
      const status = await this.mobilePaymentsService.checkTransactionStatus(
        transactionId,
        provider
      );

      // Update database with latest status
      const transaction = await this.databaseService.getTransactionById(
        transactionId
      );
      if (transaction) {
        await this.databaseService.updateTransaction(transactionId, {
          status: status.status,
          error_message: status.message,
        });
      }

      return {
        success: true,
        data: status,
      };
    } catch (error: any) {
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
   * Cancel a pending transaction
   */
  @Post('transactions/:transactionId/cancel')
  async cancelTransaction(
    @Param('transactionId') transactionId: string,
    @Query('provider') provider?: string
  ) {
    try {
      const success = await this.mobilePaymentsService.cancelTransaction(
        transactionId,
        provider
      );

      if (success) {
        await this.databaseService.updateTransaction(transactionId, {
          status: 'cancelled',
        });
      }

      return {
        success,
        message: success
          ? 'Transaction cancelled successfully'
          : 'Failed to cancel transaction',
      };
    } catch (error: any) {
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
  async getTransaction(@Param('transactionId') transactionId: string) {
    try {
      const transaction = await this.databaseService.getTransactionById(
        transactionId
      );

      if (!transaction) {
        throw new HttpException(
          {
            success: false,
            message: 'Transaction not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        data: transaction,
      };
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
  async getTransactionByReference(@Param('reference') reference: string) {
    try {
      const transaction = await this.databaseService.getTransactionByReference(
        reference
      );

      if (!transaction) {
        throw new HttpException(
          {
            success: false,
            message: 'Transaction not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        data: transaction,
      };
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
   * Get transaction history
   */
  @Get('transactions')
  async getTransactions(
    @Query('provider') provider?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    try {
      const transactions = await this.databaseService.getTransactions({
        provider,
        status,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      return {
        success: true,
        data: transactions,
      };
    } catch (error: any) {
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
   * Get transaction statistics
   */
  @Get('statistics')
  async getStatistics(
    @Query('provider') provider?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      const stats = await this.databaseService.getTransactionStats({
        provider,
        startDate,
        endDate,
      });

      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
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
   * Payment callback endpoint for MyPVIT
   */
  @Public()
  @Post('callback/mypvit')
  async mypvitCallback(@Body() callbackData: MyPVitCallbackDto) {
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

      return await this.callbackProcessor.processMypvitCallback(callbackData);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('MyPVIT callback processing error:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to process callback',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Payment callback endpoint for Freemopay (Cameroon)
   */
  @Public()
  @Post('callback/freemopay')
  async freemopayCallback(@Body() callbackData: FreemopayCallbackDto) {
    this.logger.log('freemopayCallback', JSON.stringify(callbackData));
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
        callbackData
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Freemopay callback processing error:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to process callback',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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
   * Handle secret refresh webhook callback
   */
  @Public()
  @Post('secret-refresh')
  async handleSecretRefreshCallback(
    @Body()
    webhookData: {
      merchant_operation_account_code: string;
      secret_key: string;
      expires_in: number;
    },
    @Query('provider') provider?: string
  ) {
    try {
      console.log('Received secret refresh webhook:', {
        ...(webhookData as object),
        provider,
      });

      if (!webhookData.secret_key) {
        throw new Error('Missing required webhook data: secret_key');
      }

      const environment = process.env.NODE_ENV || 'development';
      const secretName = `${environment}-rendasua-backend-secrets`;

      // Determine which secret key to update based on operation account code
      const airtelAccountCode =
        process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE ||
        'ACC_68A722C33473B';
      const moovAccountCode =
        process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE ||
        'ACC_68A722C33473B';

      let secretKeyName: string;
      if (webhookData.merchant_operation_account_code === airtelAccountCode) {
        secretKeyName = 'AIRTEL_MYPVIT_SECRET_KEY'; // RENAMED
        console.log('Updating Airtel secret key');
      } else if (
        webhookData.merchant_operation_account_code === moovAccountCode
      ) {
        secretKeyName = 'MOOV_MYPVIT_SECRET_KEY';
        console.log('Updating MOOV secret key');
      } else {
        throw new Error('Invalid merchant operation account code');
      }

      console.log(
        `Updating ${secretKeyName} in AWS Secrets Manager:`,
        secretName
      );

      await this.mobilePaymentsService.updateSecretInSecretsManager(
        secretName,
        secretKeyName,
        webhookData.secret_key
      );

      return {
        success: true,
        data: {
          message: `${secretKeyName} updated successfully`,
          secretName,
          operation_account_code: webhookData.merchant_operation_account_code,
          expires_in: webhookData.expires_in,
          updated_at: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('Error handling secret refresh webhook:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to handle secret refresh webhook',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
}
