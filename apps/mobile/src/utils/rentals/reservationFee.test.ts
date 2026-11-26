import { describe, expect, it } from 'vitest';
import {
  cardDueAtPickup,
  dueAtPickup,
  feeOutcome,
  feePaid,
  pickupDepositHold,
  reserveMode,
  showsPayAtPickupCard,
} from './reservationFee';

const cardBooking = {
  status: 'reserved',
  currency: 'CAD',
  total_amount: 54,
  security_deposit_amount: 180,
  payment_timing: 'pay_at_pickup',
  payment_status: 'pending',
  card_pay_at_pickup: true,
  reservation_fee_amount: 5.4,
  reservation_fee_status: 'paid',
};
const momoBooking = {
  status: 'reserved',
  currency: 'XAF',
  total_amount: 12000,
  security_deposit_amount: 5000,
  payment_timing: 'pay_at_pickup',
  payment_status: 'pending',
  reservation_fee_amount: 1200,
  reservation_fee_status: 'paid',
};

describe('reserve now, pay at pickup', () => {
  it('keeps the up-front card hold for bookings without the new path', () => {
    expect(reserveMode({ card_pay_at_pickup: false }, true)).toBe('card_upfront');
    expect(reserveMode({ reservation_fee_amount: 0 }, true)).toBe('card_upfront');
  });

  it('reserves for free or with the fee on the new path', () => {
    expect(reserveMode({ card_pay_at_pickup: true }, true)).toBe('free');
    expect(reserveMode({ card_pay_at_pickup: true, reservation_fee_amount: 5.4 }, true)).toBe('fee');
    expect(reserveMode({ reservation_fee_amount: 0 }, false)).toBe('free');
    expect(reserveMode({ reservation_fee_amount: '1200' }, false)).toBe('fee');
  });

  it('counts a paid fee toward the total', () => {
    expect(feePaid(cardBooking)).toBe(5.4);
    expect(dueAtPickup(cardBooking)).toBe(48.6);
    expect(dueAtPickup(momoBooking)).toBe(10800);
    expect(dueAtPickup({ ...momoBooking, reservation_fee_status: 'pending' })).toBe(12000);
    expect(dueAtPickup({ ...momoBooking, reservation_fee_status: 'refunded' })).toBe(12000);
  });

  it('holds a deposit at pickup only for card currencies', () => {
    expect(pickupDepositHold(cardBooking)).toBe(180);
    expect(pickupDepositHold(momoBooking)).toBe(0);
  });

  it('needs Pay & start until the card is authorized', () => {
    expect(cardDueAtPickup(cardBooking)).toBe(true);
    expect(cardDueAtPickup({ ...cardBooking, payment_status: 'authorized' })).toBe(false);
    expect(cardDueAtPickup({ ...cardBooking, card_pay_at_pickup: false })).toBe(false);
  });

  it('shows the pay-at-pickup card only before the rental is paid', () => {
    expect(showsPayAtPickupCard(cardBooking)).toBe(true);
    expect(showsPayAtPickupCard(momoBooking)).toBe(true);
    expect(showsPayAtPickupCard({ ...momoBooking, status: 'active' })).toBe(false);
    expect(showsPayAtPickupCard({ ...momoBooking, status: 'confirmed', payment_status: 'paid' })).toBe(false);
    expect(showsPayAtPickupCard({ status: 'reserved', payment_timing: 'pay_now' })).toBe(false);
  });

  it('reads the fee outcome', () => {
    expect(feeOutcome(momoBooking)).toBe('paid');
    expect(feeOutcome({ ...momoBooking, reservation_fee_status: 'forfeited' })).toBe('kept');
    expect(feeOutcome({ ...momoBooking, reservation_fee_status: 'refunded' })).toBe('refunded');
    expect(feeOutcome({ ...momoBooking, reservation_fee_amount: 0 })).toBe('none');
  });
});
