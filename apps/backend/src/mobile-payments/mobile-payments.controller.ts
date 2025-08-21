import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsService } from './mobile-payments.service';

export interface InitiatePaymentDto {
  amount: number;
  currency: string;
  reference: string;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
  callbackUrl?: string;
  returnUrl?: string;
  provider?: 'mypvit' | 'airtel' | 'moov' | 'mtn';
  paymentMethod?: 'mobile_money' | 'card' | 'bank_transfer';
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
export class MobilePaymentsController {
  constructor(
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly databaseService: MobilePaymentsDatabaseService
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
    } catch (error) {
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
    } catch (error) {
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
      // Create transaction record in database
      const transaction = await this.databaseService.createTransaction({
        reference: paymentRequest.reference,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        description: paymentRequest.description,
        provider: paymentRequest.provider || 'mypvit',
        payment_method: paymentRequest.paymentMethod || 'mobile_money',
        customer_phone: paymentRequest.customerPhone,
        customer_email: paymentRequest.customerEmail,
        callback_url: paymentRequest.callbackUrl,
        return_url: paymentRequest.returnUrl,
      });

      // Initiate payment with provider
      const paymentResponse = await this.mobilePaymentsService.initiatePayment(
        paymentRequest
      );

      // Update transaction with provider response
      if (paymentResponse.success && paymentResponse.transactionId) {
        await this.databaseService.updateTransaction(transaction.id, {
          transaction_id: paymentResponse.transactionId,
          payment_url: paymentResponse.paymentUrl,
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
   * Payment callback endpoint
   */
  @Post('callback/:provider')
  async paymentCallback(
    @Param('provider') provider: string,
    @Body() callbackData: PaymentCallbackDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      // Extract signature and timestamp from headers
      const signature = req.headers['x-signature'] as string;
      const timestamp = req.headers['x-timestamp'] as string;

      // Verify callback signature
      const isValid = await this.mobilePaymentsService.verifyCallback(
        callbackData,
        signature,
        timestamp,
        provider
      );

      if (!isValid) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid callback signature',
        });
      }

      // Log the callback
      if (callbackData.transaction_id) {
        await this.databaseService.logCallback(
          callbackData.transaction_id,
          callbackData
        );
      }

      // Update transaction status if we have a reference
      if (callbackData.reference) {
        const transaction =
          await this.databaseService.getTransactionByReference(
            callbackData.reference
          );
        if (transaction) {
          await this.databaseService.updateTransaction(transaction.id, {
            status: callbackData.status as any,
            error_message: callbackData.message,
          });
        }
      }

      // Return success response
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Callback processed successfully',
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to process callback',
        error: error.message,
      });
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
    } catch (error) {
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
   * Renew secret key
   */
  @Post('renew-secret')
  async renewSecretKey(@Query('provider') provider?: string) {
    try {
      const result = await this.mobilePaymentsService.renewSecretKey(provider);
      return {
        success: result.success,
        data: {
          newSecretKey: result.newSecretKey,
          message: result.message,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to renew secret key',
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
    } catch (error) {
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
    } catch (error) {
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
