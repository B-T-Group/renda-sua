import { HttpException, HttpStatus } from '@nestjs/common';
import type { AccountsService } from '../../accounts/accounts.service';
import type { HasuraSystemService } from '../../hasura/hasura-system.service';
import type { StripeCaptureService } from '../../stripe-payments/stripe-capture.service';
import { stripeRefundWalletKey } from '../../stripe-payments/stripe-refund-wallet';
import { assertLedgerResult, rentalLedgerKey } from '../rental-ledger';
import { reservationFeeEntityId, type ReservationFeeStatus } from './reservation-fee.policy';

export interface FeeBooking {
  id: string;
  booking_number?: string | null;
  currency: string;
  client?: { user_id?: string | null } | null;
  rental_location_listing?: { business_location_id?: string | null } | null;
  reservation_fee_amount?: number | string | null;
  reservation_fee_status?: string | null;
  reservation_fee_ref?: string | null;
  reservation_fee_rail?: string | null;
}

const FEE_CAS = `
  mutation ReservationFeeCas($id: uuid!, $from: [order_deposit_status_enum!]!, $_set: rental_bookings_set_input!) {
    update_rental_bookings(
      where: { id: { _eq: $id }, reservation_fee_status: { _in: $from } }
      _set: $_set
    ) { affected_rows }
  }
`;

/**
 * Reservation fee money. The fee sits in the renter's Rendasua wallet as a hold
 * (card payments are credited to the wallet by the Stripe webhook, Mobile Money by
 * the collect callback). One reference per booking (reservation_fee_ref) keys the
 * hold, release and payment, so a refund racing a forfeit cannot both move money.
 *
 * - hold: after the fee is paid.
 * - refund: release. A card fee also leaves the wallet and goes back to the card.
 * - forfeit: release, then pay the business (rentals carry no commission today).
 * - apply: release at settlement so the contract payment covers the full total.
 */
export class ReservationFeeLedger {
  constructor(
    private readonly accounts: AccountsService,
    private readonly hasura: HasuraSystemService,
    private readonly stripeCapture?: StripeCaptureService
  ) {}

  amount(booking: FeeBooking): number {
    const value = Number(booking.reservation_fee_amount);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  /** Compare-and-set on the fee status. */
  async cas(
    bookingId: string,
    from: ReservationFeeStatus[],
    set: Record<string, unknown>
  ): Promise<boolean> {
    const result = await this.hasura.executeMutation<{
      update_rental_bookings?: { affected_rows?: number } | null;
    }>(FEE_CAS, { id: bookingId, from, _set: set });
    return (result?.update_rental_bookings?.affected_rows ?? 0) > 0;
  }

  /** Hold the fee in the renter wallet (idempotent on the fee reference). */
  async hold(booking: FeeBooking): Promise<void> {
    const amount = this.amount(booking);
    if (amount <= 0) return;
    const accountId = await this.clientAccountId(booking);
    const held = await this.accounts.registerHoldIfNotExists({
      accountId,
      amount,
      memo: `Rental reservation fee hold ${booking.id}`,
      referenceId: this.ref(booking),
      idempotencyKey: rentalLedgerKey(booking.id, 'fee:hold'),
    });
    assertLedgerResult(held, 'reservation fee hold');
  }

  /** Paid fee -> refunded. Card fees go back to the card; wallet and MoMo stay in the wallet. */
  async refund(booking: FeeBooking): Promise<boolean> {
    if (this.amount(booking) <= 0) return false;
    if (!(await this.cas(booking.id, ['paid'], { reservation_fee_status: 'refunded', reservation_fee_settled_at: now() }))) {
      return false;
    }
    try {
      await this.release(booking, 'refund');
      if (booking.reservation_fee_rail === 'card') await this.refundToCard(booking);
      return true;
    } catch (error) {
      await this.cas(booking.id, ['refunded'], { reservation_fee_status: 'paid', reservation_fee_settled_at: null });
      throw error;
    }
  }

  /** Paid fee -> forfeited: the business keeps it. */
  async forfeit(booking: FeeBooking): Promise<boolean> {
    if (this.amount(booking) <= 0) return false;
    if (!(await this.cas(booking.id, ['paid'], { reservation_fee_status: 'forfeited', reservation_fee_settled_at: now() }))) {
      return false;
    }
    try {
      await this.release(booking, 'forfeit');
      await this.payBusiness(booking, 'forfeit');
      return true;
    } catch (error) {
      await this.cas(booking.id, ['forfeited'], { reservation_fee_status: 'paid', reservation_fee_settled_at: null });
      throw error;
    }
  }

  /**
   * Settlement. Wallet rail: release only; the contract payment (total) then covers it.
   * Card rail: the capture is (total - fee), so the fee is paid to the business here.
   */
  async apply(booking: FeeBooking, payToBusiness: boolean): Promise<boolean> {
    if (this.amount(booking) <= 0) return false;
    if (!(await this.cas(booking.id, ['paid'], { reservation_fee_status: 'applied', reservation_fee_settled_at: now() }))) {
      return false;
    }
    try {
      await this.release(booking, 'apply');
      if (payToBusiness) await this.payBusiness(booking, 'apply');
      return true;
    } catch (error) {
      await this.cas(booking.id, ['applied'], { reservation_fee_status: 'paid', reservation_fee_settled_at: null });
      throw error;
    }
  }

  private async release(booking: FeeBooking, why: string): Promise<void> {
    const accountId = await this.clientAccountId(booking);
    const released = await this.accounts.registerReleaseIfNotExists({
      accountId,
      amount: this.amount(booking),
      memo: `Rental reservation fee ${why} ${booking.id}`,
      referenceId: this.ref(booking),
      idempotencyKey: rentalLedgerKey(booking.id, 'fee:release'),
    });
    assertLedgerResult(released, 'reservation fee release');
  }

  private async payBusiness(booking: FeeBooking, why: string): Promise<void> {
    const amount = this.amount(booking);
    const clientAccountId = await this.clientAccountId(booking);
    const businessAccountId = await this.businessAccountId(booking);
    const paid = await this.accounts.registerPaymentIfNotExists({
      accountId: clientAccountId,
      amount,
      memo: `Rental reservation fee ${why} ${booking.id}`,
      referenceId: this.ref(booking),
      idempotencyKey: rentalLedgerKey(booking.id, 'fee:payment'),
    });
    assertLedgerResult(paid, 'reservation fee payment');
    const credited = await this.accounts.registerDepositIfNotExists({
      accountId: businessAccountId,
      amount,
      memo: `Rental reservation fee proceeds ${booking.id}`,
      referenceId: this.ref(booking),
      skipCashAdvanceRepayment: true,
      idempotencyKey: rentalLedgerKey(booking.id, 'fee:proceeds'),
    });
    assertLedgerResult(credited, 'reservation fee proceeds');
  }

  private async refundToCard(booking: FeeBooking): Promise<void> {
    const transactionId = await this.refundFeeCharge(booking);
    const accountId = await this.clientAccountId(booking);
    const left = await this.accounts.registerWithdrawalIfNotExists({
      accountId,
      amount: this.amount(booking),
      memo: `Rental reservation fee refunded to card ${booking.id}`,
      referenceId: transactionId,
      idempotencyKey: stripeRefundWalletKey(transactionId),
    });
    assertLedgerResult(left, 'reservation fee card refund');
  }

  /** Card refund. The wallet key matches charge.refunded so the webhook does not debit again. */
  private async refundFeeCharge(booking: FeeBooking): Promise<string> {
    const number = booking.booking_number;
    if (!number || !this.stripeCapture) throw feeRefundFailed();
    const refunded = await this.stripeCapture.refundCapturedPayment({
      orderNumber: reservationFeeEntityId(number),
      idempotencyKey: rentalLedgerKey(booking.id, 'fee:card-refund'),
    });
    if (!refunded.success || !refunded.transactionId) throw feeRefundFailed();
    return refunded.transactionId;
  }

  private ref(booking: FeeBooking): string {
    const ref = booking.reservation_fee_ref?.trim();
    if (!ref) throw new HttpException('Reservation fee reference missing', HttpStatus.CONFLICT);
    return ref;
  }

  private async clientAccountId(booking: FeeBooking): Promise<string> {
    const userId = booking.client?.user_id;
    if (!userId) throw new HttpException('Client account missing', HttpStatus.BAD_REQUEST);
    const account = await this.hasura.getAccount(userId, booking.currency);
    if (!account?.id) throw new HttpException('Client account missing', HttpStatus.BAD_REQUEST);
    return account.id;
  }

  private async businessAccountId(booking: FeeBooking): Promise<string> {
    const locId = booking.rental_location_listing?.business_location_id;
    if (!locId) throw new HttpException('Location missing', HttpStatus.BAD_REQUEST);
    const account = await this.hasura.ensureAccountForBusinessLocation(locId);
    if (!account?.id) throw new HttpException('Business account missing', HttpStatus.BAD_REQUEST);
    return account.id;
  }
}

function feeRefundFailed(): HttpException {
  return new HttpException(
    'Could not refund the reservation fee to the card. Please try again.',
    HttpStatus.BAD_GATEWAY
  );
}

function now(): string {
  return new Date().toISOString();
}
