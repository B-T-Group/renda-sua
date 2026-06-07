import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { RentalsService } from './rentals.service';

@Injectable()
export class RentalPaymentCallbackHandler implements PaymentCallbackHandler {
  private readonly logger = new Logger(RentalPaymentCallbackHandler.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  private resolveRentalsService(): Promise<RentalsService> {
    return this.moduleRef.resolve(RentalsService);
  }

  supportsPaymentEntity(paymentEntity: string | undefined): boolean {
    return paymentEntity === 'rental_booking';
  }

  async finalizeCashReconciliationAfterPayment(
    _transaction: MobilePaymentTransaction
  ): Promise<void> {
    return;
  }

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    const rentalsService = await this.resolveRentalsService();
    await rentalsService.processRentalBookingPayment(transaction);
  }

  async onPaymentFailure(
    transaction: MobilePaymentTransaction,
    _message: string
  ): Promise<void> {
    const bookingNumber =
      transaction.entity_id || transaction.reference || 'unknown';
    this.logger.log(
      `Rental booking payment callback FAILED for booking ${bookingNumber} (will keep booking retryable).`
    );
  }
}
