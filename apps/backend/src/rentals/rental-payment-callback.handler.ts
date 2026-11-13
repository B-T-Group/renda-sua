import { Injectable, Logger } from '@nestjs/common';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { ChargeAtPickupService } from './card-pickup/charge-at-pickup.service';
import { RentalsService } from './rentals.service';
import type { StripePaymentTransaction } from '../stripe-payments/stripe-payments-database.service';

const CARD_ENTITIES = new Set([
  'rental_pickup_contract',
  'rental_deposit',
  'rental_remainder',
]);

@Injectable()
export class RentalPaymentCallbackHandler implements PaymentCallbackHandler {
  private readonly logger = new Logger(RentalPaymentCallbackHandler.name);

  constructor(
    private readonly rentalsService: RentalsService,
    private readonly chargeAtPickup: ChargeAtPickupService
  ) {}

  supportsPaymentEntity(paymentEntity: string | undefined): boolean {
    return paymentEntity === 'rental_booking' || CARD_ENTITIES.has(paymentEntity ?? '');
  }

  async onSetupIntentSucceeded(intent: {
    id: string;
    status: string | null;
    metadata?: { bookingId?: string } | null;
    payment_method?: string | { id?: string } | null;
    customer?: string | { id?: string } | null;
  }): Promise<void> {
    await this.chargeAtPickup.onSetupSucceeded(intent as never);
  }

  async finalizeCashReconciliationAfterPayment(
    _transaction: MobilePaymentTransaction
  ): Promise<void> {
    return;
  }

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    if (transaction.payment_entity === 'rental_pickup_contract') {
      await this.chargeAtPickup.onContractEvent(this.asStripe(transaction));
      return;
    }
    if (transaction.payment_entity === 'rental_remainder') {
      await this.chargeAtPickup.onRemainderPaid(this.asStripe(transaction));
      return;
    }
    if (transaction.payment_entity === 'rental_deposit') return;
    await this.rentalsService.processRentalBookingPayment(transaction);
  }

  /** Stripe manual-capture authorization (contract + deposit held on card). */
  async onPaymentAuthorized(transaction: MobilePaymentTransaction): Promise<void> {
    if (transaction.payment_entity === 'rental_deposit') {
      await this.chargeAtPickup.onDepositAuthorized(this.asStripe(transaction), null);
      return;
    }
    if (transaction.payment_entity !== 'rental_booking') return;
    await this.rentalsService.processRentalBookingAuthorization(transaction);
  }

  private asStripe(transaction: MobilePaymentTransaction): StripePaymentTransaction {
    return {
      id: transaction.id,
      reference: transaction.reference,
      amount: transaction.amount,
      currency: transaction.currency,
      status: 'success',
      transaction_type: 'PAYMENT',
      payment_entity: transaction.payment_entity as StripePaymentTransaction['payment_entity'],
      entity_id: transaction.entity_id,
      stripe_payment_intent_id: transaction.transaction_id,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    };
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
