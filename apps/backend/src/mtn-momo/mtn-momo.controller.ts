import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { MtnMomoDatabaseService } from './mtn-momo-database.service';
import type {
  CollectionRequest,
  DisbursementRequest,
  RemittanceRequest,
} from './mtn-momo.service';
import { MtnMomoService } from './mtn-momo.service';

@Controller('mtn-momo')
export class MtnMomoController {
  private readonly logger = new Logger(MtnMomoController.name);

  constructor(
    private readonly mtnMomoService: MtnMomoService,
    private readonly mtnMomoDatabaseService: MtnMomoDatabaseService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  /**
   * Request payment from a customer (Collection)
   */
  @Post('collection/request-to-pay')
  @HttpCode(HttpStatus.OK)
  async requestToPay(@Body() request: CollectionRequest) {
    try {
      this.logger.log(
        `Collection request received: ${JSON.stringify(request)}`
      );

      // Validate request
      if (
        !request.amount ||
        !request.currency ||
        !request.externalId ||
        !request.payer
      ) {
        throw new BadRequestException('Missing required fields');
      }

      // Get the current user's ID from the JWT token
      const user = await this.hasuraUserService.getUser();
      const userId = user.id;

      const result = await this.mtnMomoService.requestToPay(request, userId);

      if (!result.status) {
        throw new BadRequestException(
          result.error || 'Collection request failed'
        );
      }

      return {
        success: true,
        data: result,
        message: 'Collection request initiated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Collection request error: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Check collection payment status
   */
  @Get('collection/status/:referenceId')
  async getCollectionStatus(@Param('referenceId') referenceId: string) {
    try {
      this.logger.log(`Checking collection status for: ${referenceId}`);

      const result = await this.mtnMomoService.requestToPayDeliveryNotification(
        referenceId
      );

      return {
        success: result.status,
        data: result,
        message: result.status
          ? 'Payment status retrieved successfully'
          : 'Payment status check failed',
      };
    } catch (error) {
      this.logger.error(
        `Collection status check error: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Send money to a customer (Disbursement)
   */
  @Post('disbursement/transfer')
  @HttpCode(HttpStatus.OK)
  async transfer(@Body() request: DisbursementRequest) {
    try {
      this.logger.log(
        `Disbursement request received: ${JSON.stringify(request)}`
      );

      // Validate request
      if (
        !request.amount ||
        !request.currency ||
        !request.externalId ||
        !request.payee
      ) {
        throw new BadRequestException('Missing required fields');
      }

      const result = await this.mtnMomoService.transfer(request);

      if (!result.status) {
        throw new BadRequestException(result.error || 'Disbursement failed');
      }

      return {
        success: true,
        data: result,
        message: 'Disbursement initiated successfully',
      };
    } catch (error) {
      this.logger.error(`Disbursement error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Check disbursement status
   */
  @Get('disbursement/status/:referenceId')
  async getDisbursementStatus(@Param('referenceId') referenceId: string) {
    try {
      this.logger.log(`Checking disbursement status for: ${referenceId}`);

      const result = await this.mtnMomoService.transferDeliveryNotification(
        referenceId
      );

      return {
        success: result.status,
        data: result,
        message: result.status
          ? 'Transfer status retrieved successfully'
          : 'Transfer status check failed',
      };
    } catch (error) {
      this.logger.error(
        `Disbursement status check error: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Send money internationally (Remittance)
   */
  @Post('remittance/transfer')
  @HttpCode(HttpStatus.OK)
  async remittance(@Body() request: RemittanceRequest) {
    try {
      this.logger.log(
        `Remittance request received: ${JSON.stringify(request)}`
      );

      // Validate request
      if (
        !request.amount ||
        !request.currency ||
        !request.externalId ||
        !request.payee
      ) {
        throw new BadRequestException('Missing required fields');
      }

      const result = await this.mtnMomoService.remittance(request);

      if (!result.status) {
        throw new BadRequestException(result.error || 'Remittance failed');
      }

      return {
        success: true,
        data: result,
        message: 'Remittance initiated successfully',
      };
    } catch (error) {
      this.logger.error(`Remittance error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  @Get('balance')
  async getAccountBalance(
    @Query('type')
    type: 'collection' | 'disbursement' | 'remittance' = 'collection'
  ) {
    try {
      this.logger.log(`Balance check requested for type: ${type}`);

      const result = await this.mtnMomoService.getAccountBalance(type);

      return {
        success: result.status,
        data: result,
        message: result.status
          ? 'Balance retrieved successfully'
          : 'Balance check failed',
      };
    } catch (error) {
      this.logger.error(`Balance check error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Validate account holder
   */
  @Get('validate-account')
  async validateAccountHolder(
    @Query('partyId') partyId: string,
    @Query('partyIdType') partyIdType: 'MSISDN' | 'EMAIL' | 'PARTY_CODE',
    @Query('type')
    type: 'collection' | 'disbursement' | 'remittance' = 'collection'
  ) {
    try {
      this.logger.log(
        `Account validation requested for: ${partyId} (${partyIdType})`
      );

      if (!partyId || !partyIdType) {
        throw new BadRequestException('partyId and partyIdType are required');
      }

      const result = await this.mtnMomoService.validateAccountHolder(
        partyId,
        partyIdType,
        type
      );

      return {
        success: result.status,
        data: result,
        message: result.status
          ? 'Account validation completed'
          : 'Account validation failed',
      };
    } catch (error) {
      this.logger.error(
        `Account validation error: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Get payment requests for a user
   */
  @Get('payment-requests/:userId')
  async getUserPaymentRequests(@Param('userId') userId: string) {
    try {
      this.logger.log(`Getting payment requests for user: ${userId}`);

      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      const paymentRequests =
        await this.mtnMomoDatabaseService.getUserPaymentRequests(userId);

      return {
        success: true,
        data: paymentRequests,
        message: `Found ${paymentRequests.length} payment requests`,
      };
    } catch (error) {
      this.logger.error(
        `Get user payment requests error: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Get payment request by transaction ID
   */
  @Get('payment-request/transaction/:transactionId')
  async getPaymentRequestByTransactionId(
    @Param('transactionId') transactionId: string
  ) {
    try {
      this.logger.log(
        `Getting payment request for transaction: ${transactionId}`
      );

      if (!transactionId) {
        throw new BadRequestException('Transaction ID is required');
      }

      const paymentRequest =
        await this.mtnMomoDatabaseService.getPaymentRequestByTransactionId(
          transactionId
        );

      return {
        success: true,
        data: paymentRequest,
        message: paymentRequest
          ? 'Payment request found'
          : 'Payment request not found',
      };
    } catch (error) {
      this.logger.error(
        `Get payment request by transaction ID error: ${
          (error as Error).message
        }`
      );
      throw error;
    }
  }

  /**
   * Webhook endpoint for MTN MoMo callbacks
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() callbackData: any) {
    try {
      this.logger.log(`Webhook received: ${JSON.stringify(callbackData)}`);

      await this.mtnMomoService.handleCallback(callbackData);

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error(
        `Webhook processing error: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  async healthCheck() {
    try {
      // Try to get collection balance as a health check
      const balance = await this.mtnMomoService.getAccountBalance('collection');

      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        balance: balance.status ? 'Available' : 'Unavailable',
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${(error as Error).message}`);
      return {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      };
    }
  }
}
