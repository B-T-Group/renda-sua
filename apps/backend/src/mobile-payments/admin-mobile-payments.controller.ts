import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
} from './mobile-payment-callback.dto';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import type { MobileTransactionStatus } from './mobile-payments.service';
import { MobilePaymentsService } from './mobile-payments.service';

@ApiTags('admin-mobile-payments')
@Controller('admin/mobile-payments')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class AdminMobilePaymentsController {
  constructor(
    private readonly databaseService: MobilePaymentsDatabaseService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly callbackProcessor: MobilePaymentCallbackProcessor
  ) {}

  @Get('pending')
  @ApiOperation({ summary: 'List pending MyPVit / Freemopay transactions' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of pending transactions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listPending(
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string
  ) {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitStr || '50', 10) || 50)
    );
    const offset = Math.max(0, parseInt(offsetStr || '0', 10) || 0);
    const items =
      await this.databaseService.getPendingIntegrationTransactions({
        limit,
        offset,
      });
    return { success: true, data: { items, limit, offset } };
  }

  @Get(':id/provider-status')
  @ApiOperation({
    summary: 'Fetch live payment status from provider (does not update DB)',
  })
  @ApiParam({ name: 'id', description: 'mobile_payment_transactions.id (UUID)' })
  @ApiResponse({ status: 200, description: 'Provider status snapshot' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getProviderStatus(@Param('id') id: string) {
    const tx = await this.databaseService.getTransactionById(id);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    if (!tx.transaction_id?.trim()) {
      throw new BadRequestException('Transaction has no provider transaction_id');
    }

    let provider: 'mypvit' | 'freemopay';
    try {
      provider = this.mobilePaymentsService.resolveAdminIntegrationProvider(
        tx.customer_phone,
        tx.provider
      );
    } catch (error: any) {
      if (error?.message === 'UNSUPPORTED_INTEGRATION_PROVIDER') {
        throw new BadRequestException(
          'Cannot determine integration provider (add customer_phone or use mypvit/freemopay)'
        );
      }
      throw error;
    }

    const live = await this.mobilePaymentsService.checkTransactionStatus(
      tx.transaction_id,
      provider
    );

    return {
      success: true,
      data: {
        providerStatus: live,
        dbStatus: tx.status,
        dbReference: tx.reference,
        provider,
      },
    };
  }

  @Post(':id/resolve')
  @ApiOperation({
    summary:
      'Poll provider status; if terminal, replay callback processing (pending rows only)',
  })
  @ApiParam({ name: 'id', description: 'mobile_payment_transactions.id (UUID)' })
  @ApiResponse({ status: 200, description: 'Resolve attempted' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 409, description: 'Transaction not pending' })
  async resolve(@Param('id') id: string) {
    const tx = await this.databaseService.getTransactionById(id);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    if (!tx.transaction_id?.trim()) {
      throw new BadRequestException('Transaction has no provider transaction_id');
    }
    if (tx.status !== 'pending') {
      throw new ConflictException(
        `Transaction is already ${tx.status}; resolve skipped`
      );
    }

    let provider: 'mypvit' | 'freemopay';
    try {
      provider = this.mobilePaymentsService.resolveAdminIntegrationProvider(
        tx.customer_phone,
        tx.provider
      );
    } catch (error: any) {
      if (error?.message === 'UNSUPPORTED_INTEGRATION_PROVIDER') {
        throw new BadRequestException(
          'Cannot determine integration provider (add customer_phone or use mypvit/freemopay)'
        );
      }
      throw error;
    }

    let live: MobileTransactionStatus;
    try {
      live = await this.mobilePaymentsService.checkTransactionStatus(
        tx.transaction_id,
        provider
      );
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Provider status check failed',
          error: error?.message || String(error),
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    if (live.status === 'pending' || live.status === 'ambiguous') {
      return {
        success: true,
        replayed: false,
        message:
          live.status === 'ambiguous'
            ? 'Provider status uncertain; try again later'
            : 'Provider still pending',
        data: { providerStatus: live, provider },
      };
    }

    if (provider === 'mypvit') {
      const dto = this.buildMypvitReplayDto(tx, live);
      const result = await this.callbackProcessor.processMypvitCallback(dto);
      return {
        success: true,
        replayed: !result.skipped,
        data: { providerStatus: live, processor: result, provider },
      };
    }

    const dto = this.buildFreemopayReplayDto(tx, live);
    const result = await this.callbackProcessor.processFreemopayCallback(dto);
    return {
      success: true,
      replayed: !result.skipped,
      data: { providerStatus: live, processor: result, provider },
    };
  }

  private buildMypvitReplayDto(
    tx: MobilePaymentTransaction,
    live: MobileTransactionStatus
  ): MyPVitCallbackDto {
    const ok = live.status === 'success';
    return {
      transactionId: live.transactionId || tx.transaction_id || '',
      merchantReferenceId: tx.reference,
      status: ok ? 'SUCCESS' : 'FAILED',
      amount: Number(live.amount ?? tx.amount),
      customerID: this.mobilePaymentsService.nationalCustomerIdForMypvit(
        tx.customer_phone
      ),
      fees: 0,
      chargeOwner: 'CUSTOMER',
      transactionOperation: 'PAYMENT',
      operator: 'MOBILE_MONEY',
      code: ok ? 200 : 400,
    };
  }

  private buildFreemopayReplayDto(
    tx: MobilePaymentTransaction,
    live: MobileTransactionStatus
  ): FreemopayCallbackDto {
    const ok = live.status === 'success';
    return {
      reference: tx.transaction_id || '',
      externalId: tx.reference,
      status: ok ? 'SUCCESS' : 'FAILED',
      amount: Number(live.amount ?? tx.amount),
      reason: ok ? undefined : live.message || 'Payment failed',
      message: live.message,
    };
  }
}
