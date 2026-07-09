import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { RefundOrderContext, RefundPaymentResult } from './refund.types';

@Injectable()
export class WalletRefundExecutor {
  private readonly logger = new Logger(WalletRefundExecutor.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly accountsService: AccountsService
  ) {}

  async execute(params: {
    order: RefundOrderContext;
    amount: number;
    refundRequestId: string;
    paymentId: string;
    memoSuffix?: string;
  }): Promise<RefundPaymentResult> {
    const { order, amount, refundRequestId, paymentId, memoSuffix } = params;
    if (amount <= 0) {
      return {
        success: true,
        paymentId,
        destination: 'wallet',
        status: 'succeeded',
        async: false,
        message: 'No wallet credit needed',
      };
    }
    const account = await this.hasuraSystemService.getAccount(
      order.client.user_id,
      order.currency
    );
    if (!account) {
      await this.markPaymentFailed(paymentId, 'Client account not found');
      throw new HttpException('Client account not found', HttpStatus.NOT_FOUND);
    }
    const memo = memoSuffix
      ? `Refund (${memoSuffix}) for order ${order.order_number}`
      : `Refund for order ${order.order_number}`;
    const result = await this.accountsService.registerTransaction({
      accountId: account.id,
      amount,
      transactionType: 'refund',
      memo,
      referenceId: `${order.id}:${refundRequestId}:${paymentId}`,
    });
    if (!result.success) {
      await this.markPaymentFailed(paymentId, result.error || 'Wallet credit failed');
      throw new HttpException(
        result.error || 'Failed to register refund',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.markPaymentSucceeded(paymentId);
    this.logger.log(`Wallet refund ${paymentId} credited ${amount} ${order.currency}`);
    return {
      success: true,
      paymentId,
      destination: 'wallet',
      status: 'succeeded',
      async: false,
      message: 'Wallet credited',
    };
  }

  private async markPaymentSucceeded(paymentId: string): Promise<void> {
    await this.updatePayment(paymentId, { status: 'succeeded' });
  }

  private async markPaymentFailed(paymentId: string, reason: string): Promise<void> {
    await this.updatePayment(paymentId, {
      status: 'failed',
      failure_reason: reason,
    });
  }

  private async updatePayment(
    paymentId: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    const mutation = `
      mutation UpdateRefundPayment($id: uuid!, $set: order_refund_payments_set_input!) {
        update_order_refund_payments_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      id: paymentId,
      set: { ...fields, updated_at: new Date().toISOString() },
    });
  }
}
