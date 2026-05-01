import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { OrdersService } from '../orders/orders.service';
import { RentalsService } from '../rentals/rentals.service';
import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
} from './mobile-payment-callback.dto';
import {
  MobilePaymentTransaction,
  MobilePaymentsDatabaseService,
} from './mobile-payments-database.service';

export type MypvitCallbackProcessResult = {
  responseCode: number;
  transactionId: string;
  skipped?: boolean;
};

export type FreemopayCallbackProcessResult = {
  received: boolean;
  reference: string;
  skipped?: boolean;
};

@Injectable()
export class MobilePaymentCallbackProcessor {
  private readonly logger = new Logger(MobilePaymentCallbackProcessor.name);

  constructor(
    private readonly databaseService: MobilePaymentsDatabaseService,
    private readonly accountsService: AccountsService,
    private readonly ordersService: OrdersService,
    private readonly rentalsService: RentalsService
  ) {}

  async processMypvitCallback(
    callbackData: MyPVitCallbackDto
  ): Promise<MypvitCallbackProcessResult> {
    const tx = await this.databaseService.getTransactionByReference(
      callbackData.merchantReferenceId
    );
    if (tx?.status !== 'pending') {
      if (!tx) {
        await this.databaseService.logCallback(
          callbackData.transactionId,
          callbackData
        );
        this.logger.warn(
          `Transaction not found for reference: ${callbackData.merchantReferenceId}`
        );
        return {
          responseCode: callbackData.code,
          transactionId: callbackData.transactionId,
        };
      }
      this.logger.log(
        `MyPVit callback skipped (already ${tx.status}): ${tx.id}`
      );
      return {
        responseCode: callbackData.code,
        transactionId: callbackData.transactionId,
        skipped: true,
      };
    }

    await this.databaseService.logCallback(
      callbackData.transactionId,
      callbackData
    );

    await this.applyMypvitStatusUpdate(tx, callbackData);
    await this.applyMypvitSuccessCredit(tx, callbackData);
    await this.applyMypvitFailureSideEffects(tx, callbackData);

    return {
      responseCode: callbackData.code,
      transactionId: callbackData.transactionId,
    };
  }

  async processFreemopayCallback(
    callbackData: FreemopayCallbackDto
  ): Promise<FreemopayCallbackProcessResult> {
    const tx = await this.databaseService.getTransactionByTransactionId(
      callbackData.reference
    );

    if (tx?.status !== 'pending') {
      if (tx) {
        this.logger.log(
          `Freemopay callback skipped (already ${tx.status}): ${tx.id}`
        );
      } else {
        this.logger.warn(
          `Transaction not found for provider reference: ${callbackData.reference}`
        );
      }
      return {
        received: true,
        reference: callbackData.reference,
        skipped: !!tx,
      };
    }

    await this.databaseService.logCallback(tx.id, callbackData);
    await this.applyFreemopayStatusUpdate(tx, callbackData);
    await this.applyFreemopaySuccessCredit(tx, callbackData);
    await this.applyFreemopayFailureSideEffects(tx, callbackData);

    return { received: true, reference: callbackData.reference };
  }

  private async handleRentalBookingCallback(
    transaction: {
      entity_id?: string;
      reference?: string;
      payment_entity?: string;
    },
    wasSuccess: boolean
  ): Promise<void> {
    const bookingNumber =
      transaction.entity_id || transaction.reference || 'unknown';

    if (!wasSuccess) {
      this.logger.log(
        `Rental booking payment callback FAILED for booking ${bookingNumber} (will keep booking retryable).`
      );
      return;
    }

    await this.rentalsService.processRentalBookingPayment(transaction);
  }

  private async applyMypvitStatusUpdate(
    transaction: MobilePaymentTransaction,
    callbackData: MyPVitCallbackDto
  ): Promise<void> {
    const status = callbackData.status === 'SUCCESS' ? 'success' : 'failed';
    await this.databaseService.updateTransaction(transaction.id, {
      status,
      transaction_id: callbackData.transactionId,
      error_message:
        callbackData.status === 'FAILED' ? 'Payment failed' : undefined,
    });
    this.logger.log(`Updated transaction ${transaction.id} with status: ${status}`);
  }

  private async applyMypvitSuccessCredit(
    transaction: MobilePaymentTransaction,
    callbackData: MyPVitCallbackDto
  ): Promise<void> {
    if (
      callbackData.status !== 'SUCCESS' ||
      !transaction.account_id ||
      transaction.transaction_type !== 'PAYMENT'
    ) {
      return;
    }

    try {
      const creditResult = await this.accountsService.registerTransaction({
        accountId: transaction.account_id,
        amount: transaction.amount,
        transactionType: 'deposit',
        memo: `Mobile payment deposit - ${transaction.reference}`,
        referenceId: transaction.id,
      });

      if (!creditResult.success) {
        this.logger.error(
          `Failed to credit account ${transaction.account_id}: ${creditResult.error}`
        );
        return;
      }

      this.logger.log(
        `Successfully credited account ${transaction.account_id} with ${transaction.amount} ${transaction.currency}`
      );

      if (transaction.payment_entity === 'order') {
        await this.ordersService.finalizeOrderAfterIncomingPayment(transaction);
      } else if (transaction.payment_entity === 'claim_order') {
        await this.ordersService.processClaimOrderPayment(transaction);
      } else if (transaction.payment_entity === 'rental_booking') {
        await this.handleRentalBookingCallback(transaction, true);
      }
    } catch (creditError: any) {
      this.logger.error(
        `Error crediting account ${transaction.account_id}: ${String(
          creditError?.message || creditError
        )}`
      );
    }
  }

  private async applyMypvitFailureSideEffects(
    transaction: MobilePaymentTransaction,
    callbackData: MyPVitCallbackDto
  ): Promise<void> {
    if (callbackData.status !== 'FAILED') {
      return;
    }
    if (transaction.payment_entity === 'order') {
      const orderNumber = transaction.entity_id || transaction.reference;
      const order = await this.ordersService.getOrderByNumber(
        orderNumber
      );
      await this.ordersService.onOrderPaymentFailed(order.id, 'Payment failed');
    } else if (transaction.payment_entity === 'claim_order') {
      this.logger.log(
        `Claim order payment failed for order ${transaction.reference}`
      );
    } else if (transaction.payment_entity === 'rental_booking') {
      await this.handleRentalBookingCallback(transaction, false);
    }
  }

  private async applyFreemopayStatusUpdate(
    transaction: MobilePaymentTransaction,
    callbackData: FreemopayCallbackDto
  ): Promise<void> {
    const status = callbackData.status === 'SUCCESS' ? 'success' : 'failed';
    await this.databaseService.updateTransaction(transaction.id, {
      status,
      transaction_id: callbackData.reference,
      error_message:
        callbackData.status === 'FAILED'
          ? callbackData.reason ||
            callbackData.message ||
            'Payment failed'
          : undefined,
    });
    this.logger.log(`Updated transaction ${transaction.id} with status: ${status}`);
  }

  private async applyFreemopaySuccessCredit(
    transaction: MobilePaymentTransaction,
    callbackData: FreemopayCallbackDto
  ): Promise<void> {
    if (
      callbackData.status !== 'SUCCESS' ||
      !transaction.account_id ||
      transaction.transaction_type !== 'PAYMENT'
    ) {
      return;
    }

    try {
      const creditResult = await this.accountsService.registerTransaction({
        accountId: transaction.account_id,
        amount: transaction.amount,
        transactionType: 'deposit',
        memo: `Mobile payment deposit - ${transaction.reference}`,
        referenceId: transaction.id,
      });

      if (!creditResult.success) {
        this.logger.error(
          `Failed to credit account ${transaction.account_id}: ${creditResult.error}`
        );
        return;
      }

      this.logger.log(
        `Successfully credited account ${transaction.account_id} with ${transaction.amount} ${transaction.currency}`
      );

      if (transaction.payment_entity === 'order') {
        await this.ordersService.finalizeOrderAfterIncomingPayment(transaction);
      } else if (transaction.payment_entity === 'claim_order') {
        await this.ordersService.processClaimOrderPayment(transaction);
      } else if (transaction.payment_entity === 'rental_booking') {
        await this.handleRentalBookingCallback(transaction, true);
      }
    } catch (creditError: any) {
      this.logger.error(
        `Error crediting account ${transaction.account_id}:`,
        creditError
      );
    }
  }

  private async applyFreemopayFailureSideEffects(
    transaction: MobilePaymentTransaction,
    callbackData: FreemopayCallbackDto
  ): Promise<void> {
    if (callbackData.status !== 'FAILED') {
      return;
    }
    if (transaction.payment_entity === 'order') {
      const orderNumber = transaction.entity_id || transaction.reference;
      const order = await this.ordersService.getOrderByNumber(
        orderNumber
      );
      const failureMessage =
        callbackData.reason || callbackData.message || 'Payment failed';
      await this.ordersService.onOrderPaymentFailed(order.id, failureMessage);
    } else if (transaction.payment_entity === 'claim_order') {
      this.logger.log(
        `Claim order payment failed for order ${transaction.reference}`
      );
    } else if (transaction.payment_entity === 'rental_booking') {
      await this.handleRentalBookingCallback(transaction, false);
    }
  }
}
