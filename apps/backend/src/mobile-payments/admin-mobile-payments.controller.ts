import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import {
  buildFreemopayReplayDto,
  buildMypvitReplayDto,
} from './callback-replay.util';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import {
  MobilePaymentsDatabaseService,
  type MobilePaymentTransaction,
} from './mobile-payments-database.service';
import type {
  MobilePaymentIntegrationProvider,
  MobileTransactionStatus,
} from './mobile-payments.service';
import { MobilePaymentsService } from './mobile-payments.service';

@ApiTags('admin-mobile-payments')
@Controller('admin/mobile-payments')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.FINANCIAL_MOBILE_PAYMENTS)
@ApiBearerAuth()
export class AdminMobilePaymentsController {
  private readonly logger = new Logger(AdminMobilePaymentsController.name);

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
    const tx = await this.requireTransaction(id);
    const providerTxId = this.requireProviderTxId(tx);
    const provider = this.resolveProvider(tx);
    const live = await this.checkLiveStatus(tx, providerTxId, provider);
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
  async resolve(@Param('id') id: string, @Req() req: Request) {
    const tx = await this.requirePendingResolvable(id);
    const providerTxId = this.requireProviderTxId(tx);
    const provider = this.resolveProvider(tx);
    const live = await this.checkLiveStatus(tx, providerTxId, provider);
    if (live.status === 'pending' || live.status === 'ambiguous') {
      return this.stillPendingResponse(live, provider);
    }
    return this.replayTerminal(tx, live, provider, req);
  }

  private async requireTransaction(
    id: string
  ): Promise<MobilePaymentTransaction> {
    const tx = await this.databaseService.getTransactionById(id);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    return tx;
  }

  private async requirePendingResolvable(
    id: string
  ): Promise<MobilePaymentTransaction> {
    const tx = await this.requireTransaction(id);
    this.requireProviderTxId(tx);
    if (tx.status !== 'pending') {
      throw new ConflictException(
        `Transaction is already ${tx.status}; resolve skipped`
      );
    }
    return tx;
  }

  private requireProviderTxId(tx: MobilePaymentTransaction): string {
    const providerTxId = tx.transaction_id?.trim();
    if (!providerTxId) {
      throw new BadRequestException('Transaction has no provider transaction_id');
    }
    return providerTxId;
  }

  private resolveProvider(
    tx: MobilePaymentTransaction
  ): MobilePaymentIntegrationProvider {
    try {
      return this.mobilePaymentsService.resolveAdminIntegrationProvider(
        tx.customer_phone,
        tx.provider
      );
    } catch (error: any) {
      if (error?.message === 'UNSUPPORTED_INTEGRATION_PROVIDER') {
        throw new BadRequestException(
          'Cannot determine integration provider (add customer_phone or use mypvit/freemopay/mtn/orange)'
        );
      }
      throw error;
    }
  }

  /**
   * Live check for admin tools. Pass the stored phone so MyPVit picks the
   * Airtel vs MOOV secret. Provider misses/timeouts stay uncertain — do not
   * apply side effects, and do not remap to HTTP 502 (Sentry noise).
   */
  private async checkLiveStatus(
    tx: MobilePaymentTransaction,
    providerTxId: string,
    provider: MobilePaymentIntegrationProvider
  ): Promise<MobileTransactionStatus> {
    try {
      return await this.mobilePaymentsService.checkTransactionStatus(
        providerTxId,
        provider,
        tx.customer_phone
      );
    } catch (error: any) {
      this.logger.warn(
        `Provider status check failed for ${tx.id}: ${error?.message || error}`
      );
      return this.uncertainLiveStatus(tx, providerTxId, provider, error);
    }
  }

  private uncertainLiveStatus(
    tx: MobilePaymentTransaction,
    providerTxId: string,
    provider: MobilePaymentIntegrationProvider,
    error: any
  ): MobileTransactionStatus {
    return {
      transactionId: providerTxId,
      status: 'ambiguous',
      amount: tx.amount,
      currency: tx.currency,
      reference: tx.reference,
      message: error?.message || 'Provider status check failed',
      provider,
    };
  }

  private stillPendingResponse(
    live: MobileTransactionStatus,
    provider: MobilePaymentIntegrationProvider
  ) {
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

  private async replayTerminal(
    tx: MobilePaymentTransaction,
    live: MobileTransactionStatus,
    provider: MobilePaymentIntegrationProvider,
    req: Request
  ) {
    const result = await this.processReplay(tx, live, provider, req);
    return {
      success: true,
      replayed: !result.skipped,
      data: { providerStatus: live, processor: result, provider },
    };
  }

  private processReplay(
    tx: MobilePaymentTransaction,
    live: MobileTransactionStatus,
    provider: MobilePaymentIntegrationProvider,
    req: Request
  ) {
    if (provider === 'mypvit') {
      return this.callbackProcessor.processMypvitCallback(
        buildMypvitReplayDto(
          tx,
          live,
          this.mobilePaymentsService.nationalCustomerIdForMypvit(
            tx.customer_phone
          )
        ),
        req
      );
    }
    return this.callbackProcessor.processFreemopayCallback(
      buildFreemopayReplayDto(tx, live),
      req
    );
  }
}
