import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { CollectionRequest } from './airtel-money.service';
import { AirtelMoneyService } from './airtel-money.service';

@Controller('airtel-money')
export class AirtelMoneyController {
  constructor(
    private readonly airtelMoneyService: AirtelMoneyService,
    private readonly hasuraUserService: HasuraUserService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  /**
   * Request payment from customer
   */
  @Post('request-payment')
  async requestPayment(@Body() request: CollectionRequest) {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.airtelMoneyService.requestToPay(
        request,
        user.id
      );

      if (!result.status) {
        throw new HttpException(
          result.error || 'Payment request failed',
          HttpStatus.BAD_REQUEST
        );
      }

      return {
        success: true,
        data: result,
        message: 'Payment request initiated successfully',
      };
    } catch (error: any) {
      this.logger.error('Error in request payment endpoint', {
        error: error.message,
        service: 'AirtelMoneyController',
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get transaction status
   */
  @Get('transaction/:transactionId/status')
  async getTransactionStatus(@Param('transactionId') transactionId: string) {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.airtelMoneyService.getTransactionStatus(
        transactionId
      );

      if (!result.status) {
        throw new HttpException(
          result.error || 'Failed to get transaction status',
          HttpStatus.BAD_REQUEST
        );
      }

      return {
        success: true,
        data: result,
        message: 'Transaction status retrieved successfully',
      };
    } catch (error: any) {
      this.logger.error('Error in get transaction status endpoint', {
        error: error.message,
        service: 'AirtelMoneyController',
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Refund transaction
   */
  @Post('refund/:transactionId')
  async refundTransaction(
    @Param('transactionId') transactionId: string,
    @Body() body: { amount: string; reason?: string }
  ) {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.airtelMoneyService.refundTransaction(
        transactionId,
        body.amount,
        body.reason
      );

      if (!result.status) {
        throw new HttpException(
          result.error || 'Refund failed',
          HttpStatus.BAD_REQUEST
        );
      }

      return {
        success: true,
        data: result,
        message: 'Refund initiated successfully',
      };
    } catch (error: any) {
      this.logger.error('Error in refund transaction endpoint', {
        error: error.message,
        service: 'AirtelMoneyController',
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get account balance
   */
  @Get('balance')
  async getAccountBalance() {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.airtelMoneyService.getAccountBalance();

      if (!result.status) {
        throw new HttpException(
          result.error || 'Failed to get account balance',
          HttpStatus.BAD_REQUEST
        );
      }

      return {
        success: true,
        data: result.data,
        message: 'Account balance retrieved successfully',
      };
    } catch (error: any) {
      this.logger.error('Error in get account balance endpoint', {
        error: error.message,
        service: 'AirtelMoneyController',
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Callback endpoint for Airtel Money webhooks
   */
  @Post('callback')
  async handleCallback(@Body() callbackData: any) {
    try {
      this.logger.info('Received Airtel Money callback', {
        data: callbackData,
        service: 'AirtelMoneyController',
      });

      await this.airtelMoneyService.handleCallback(callbackData);

      return {
        success: true,
        message: 'Callback processed successfully',
      };
    } catch (error: any) {
      this.logger.error('Error handling Airtel Money callback', {
        error: error.message,
        service: 'AirtelMoneyController',
      });

      // For webhooks, we should return 200 even on error to prevent retries
      return {
        success: false,
        message: 'Callback processing failed',
      };
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  async healthCheck() {
    return {
      success: true,
      message: 'Airtel Money service is healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
