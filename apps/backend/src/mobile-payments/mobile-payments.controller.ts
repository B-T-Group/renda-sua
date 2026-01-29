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
import { AccountsService } from '../accounts/accounts.service';
import { Public } from '../auth/public.decorator';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrdersService } from '../orders/orders.service';
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

export interface MyPVitCallbackDto {
  transactionId: string;
  merchantReferenceId: string;
  status: 'SUCCESS' | 'FAILED';
  amount: number;
  customerID: string;
  fees: number;
  chargeOwner: string;
  transactionOperation: string;
  operator: string;
  code: number;
}

export interface FreemopayCallbackDto {
  reference: string;
  externalId?: string;
  merchantRef?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amount?: number;
  reason?: string;
}

@Controller('mobile-payments')
export class MobilePaymentsController {
  private readonly logger = new Logger(MobilePaymentsController.name);

  constructor(
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly databaseService: MobilePaymentsDatabaseService,
    private readonly accountsService: AccountsService,
    private readonly ordersService: OrdersService,
    private readonly hasuraUserService: HasuraUserService
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

      // Validate Airtel and MOOV providers only work with XAF currency
      if (
        (paymentRequest.provider === 'airtel' ||
          paymentRequest.provider === 'moov') &&
        paymentRequest.currency !== 'XAF'
      ) {
        throw new HttpException(
          {
            success: false,
            message:
              'Airtel Money and MOOV Money are only supported for XAF currency',
            error: 'UNSUPPORTED_CURRENCY',
            data: {
              provider: paymentRequest.provider,
              currency: paymentRequest.currency,
              supportedCurrency: 'XAF',
            },
          },
          HttpStatus.BAD_REQUEST
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
        provider: paymentRequest.provider || 'mypvit',
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
      } catch (error) {
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

        // For GIVE_CHANGE transactions, withdraw from account only after successful payment initiation
        if (
          paymentRequest.transactionType === 'GIVE_CHANGE' &&
          paymentRequest.accountId
        ) {
          try {
            const withdrawalResult =
              await this.accountsService.registerTransaction({
                accountId: paymentRequest.accountId,
                amount: paymentRequest.amount,
                transactionType: 'withdrawal',
                memo: `Mobile payment give change - ${reference}`,
                referenceId: transaction.id,
              });

            if (withdrawalResult.success) {
              console.log(
                `Successfully withdrew ${paymentRequest.amount} ${paymentRequest.currency} from account ${paymentRequest.accountId} for give change`
              );
              console.log('New balance:', withdrawalResult.newBalance);
            } else {
              console.error(
                `Failed to withdraw from account ${paymentRequest.accountId}: ${withdrawalResult.error}`
              );
              // Update transaction status to failed
              await this.databaseService.updateTransaction(transaction.id, {
                status: 'failed',
                error_message: `Withdrawal failed: ${withdrawalResult.error}`,
                error_code: 'WITHDRAWAL_FAILED',
              });
              throw new HttpException(
                {
                  success: false,
                  message: 'Failed to process withdrawal',
                  error: 'WITHDRAWAL_FAILED',
                  data: {
                    accountId: paymentRequest.accountId,
                    amount: paymentRequest.amount,
                    error: withdrawalResult.error,
                  },
                },
                HttpStatus.INTERNAL_SERVER_ERROR
              );
            }
          } catch (withdrawalError) {
            console.error(
              `Error withdrawing from account ${paymentRequest.accountId}:`,
              withdrawalError
            );
            // Update transaction status to failed
            await this.databaseService.updateTransaction(transaction.id, {
              status: 'failed',
              error_message: 'Withdrawal processing error',
              error_code: 'WITHDRAWAL_ERROR',
            });
            throw new HttpException(
              {
                success: false,
                message: 'Failed to process withdrawal',
                error: 'WITHDRAWAL_ERROR',
              },
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          }
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
        },
      };
    } catch (error: any) {
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
      // Validate required fields
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

      // Log the callback
      await this.databaseService.logCallback(
        callbackData.transactionId,
        callbackData
      );

      // Find transaction by merchant reference ID
      const transaction = await this.databaseService.getTransactionByReference(
        callbackData.merchantReferenceId
      );

      if (transaction) {
        // Map MyPVIT status to our status format
        const status = callbackData.status === 'SUCCESS' ? 'success' : 'failed';

        await this.databaseService.updateTransaction(transaction.id, {
          status,
          transaction_id: callbackData.transactionId,
          error_message:
            callbackData.status === 'FAILED' ? 'Payment failed' : undefined,
        });

        console.log(
          `Updated transaction ${transaction.id} with status: ${status}`
        );

        // If payment is successful, credit the account only for PAYMENT transactions
        if (
          callbackData.status === 'SUCCESS' &&
          transaction.account_id &&
          transaction.transaction_type === 'PAYMENT'
        ) {
          try {
            const creditResult = await this.accountsService.registerTransaction(
              {
                accountId: transaction.account_id,
                amount: transaction.amount,
                transactionType: 'deposit',
                memo: `Mobile payment deposit - ${transaction.reference}`,
                referenceId: transaction.id,
              }
            );

            if (creditResult.success) {
              console.log(
                `Successfully credited account ${transaction.account_id} with ${transaction.amount} ${transaction.currency}`
              );
              console.log('New balance:', creditResult.newBalance);

              if (transaction.payment_entity === 'order') {
                // Process order payment using the refactored method
                await this.ordersService.processOrderPayment(transaction);
              } else if (transaction.payment_entity === 'claim_order') {
                // Process claim order payment
                await this.ordersService.processClaimOrderPayment(transaction);
              }
            } else {
              console.error(
                `Failed to credit account ${transaction.account_id}: ${creditResult.error}`
              );
            }
          } catch (creditError) {
            console.error(
              `Error crediting account ${transaction.account_id}:`,
              creditError
            );
          }
        }
      } else {
        console.warn(
          `Transaction not found for reference: ${callbackData.merchantReferenceId}`
        );
      }

      if (
        callbackData.status === 'FAILED' &&
        transaction?.payment_entity === 'order'
      ) {
        const order = await this.ordersService.getOrderByNumber(
          transaction.reference
        );
        await this.ordersService.onOrderPaymentFailed(order.id);
      } else if (
        callbackData.status === 'FAILED' &&
        transaction?.payment_entity === 'claim_order'
      ) {
        // For claim order payment failures, we don't need to cancel the order
        // since the order wasn't claimed yet - just log the failure
        console.log(
          `Claim order payment failed for order ${transaction.reference}`
        );
      }

      // Return success response
      return {
        responseCode: callbackData.code,
        transactionId: callbackData.transactionId,
      };
    } catch (error: any) {
      console.error('MyPVIT callback processing error:', error);
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
    try {
      const externalId =
        callbackData.externalId ?? callbackData.merchantRef;
      if (!callbackData.reference || !externalId || !callbackData.status) {
        throw new HttpException(
          {
            success: false,
            message: 'Missing required callback data (reference, externalId/merchantRef, status)',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      await this.databaseService.logCallback(
        callbackData.reference,
        callbackData
      );

      const transaction = await this.databaseService.getTransactionByReference(
        externalId
      );

      if (transaction) {
        const status =
          callbackData.status === 'SUCCESS' ? 'success' : 'failed';

        await this.databaseService.updateTransaction(transaction.id, {
          status,
          transaction_id: callbackData.reference,
          error_message:
            callbackData.status === 'FAILED'
              ? callbackData.reason || 'Payment failed'
              : undefined,
        });

        this.logger.log(
          `Updated transaction ${transaction.id} with status: ${status}`
        );

        if (
          callbackData.status === 'SUCCESS' &&
          transaction.account_id &&
          transaction.transaction_type === 'PAYMENT'
        ) {
          try {
            const creditResult = await this.accountsService.registerTransaction(
              {
                accountId: transaction.account_id,
                amount: transaction.amount,
                transactionType: 'deposit',
                memo: `Mobile payment deposit - ${transaction.reference}`,
                referenceId: transaction.id,
              }
            );

            if (creditResult.success) {
              this.logger.log(
                `Successfully credited account ${transaction.account_id} with ${transaction.amount} ${transaction.currency}`
              );

              if (transaction.payment_entity === 'order') {
                await this.ordersService.processOrderPayment(transaction);
              } else if (transaction.payment_entity === 'claim_order') {
                await this.ordersService.processClaimOrderPayment(transaction);
              }
            } else {
              this.logger.error(
                `Failed to credit account ${transaction.account_id}: ${creditResult.error}`
              );
            }
          } catch (creditError) {
            this.logger.error(
              `Error crediting account ${transaction.account_id}:`,
              creditError
            );
          }
        }
      } else {
        this.logger.warn(
          `Transaction not found for reference: ${externalId}`
        );
      }

      if (transaction) {
        if (
          callbackData.status === 'FAILED' &&
          transaction.payment_entity === 'order'
        ) {
          const order = await this.ordersService.getOrderByNumber(
            transaction.reference
          );
          await this.ordersService.onOrderPaymentFailed(order.id);
        } else if (
          callbackData.status === 'FAILED' &&
          transaction.payment_entity === 'claim_order'
        ) {
          this.logger.log(
            `Claim order payment failed for order ${transaction.reference}`
          );
        }
      }

      return {
        received: true,
        reference: callbackData.reference,
      };
    } catch (error: any) {
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
