/**
 * Reserve now, pay at pickup (README §8, the 7 scenarios). An in-memory booking
 * row stands in for Hasura so status, payment and fee moves are read back from
 * the same state the service wrote.
 */
import { HttpException } from '@nestjs/common';
import { RentalsService } from '../rentals.service';
import { RentalsCronService } from '../rentals-cron.service';
import * as Q from '../rentals-queries';
import {
  bookingNumberFromFeeEntity,
  dueAtPickup,
  feeOutcome,
  pickupAuthFits,
  reservationFeeEntityId,
  reservationFeeFor,
} from './reservation-fee.policy';

type Row = Record<string, any>;

// Toronto (CA, Stripe) is UTC-5. 15:00Z = 10:00 on the listing clock, 27 Nov.
const NOW = new Date('2026-11-27T15:00:00.000Z');

function cardBooking(over: Row = {}): Row {
  return {
    id: 'b1',
    booking_number: 'RB-1',
    rental_request_id: 'req-1',
    client_id: 'client',
    business_id: 'biz',
    status: 'reserved',
    payment_timing: 'pay_at_pickup',
    payment_status: 'pending',
    card_pay_at_pickup: true,
    currency: 'CAD',
    total_amount: 60,
    security_deposit_amount: 180,
    reservation_fee_amount: 0,
    reservation_fee_status: 'none',
    reservation_fee_ref: null,
    reservation_fee_rail: null,
    inspection_policy_version: null,
    // wall clock: 09:00-18:00 on 27 Nov
    start_at: '2026-11-27T09:00:00.000Z',
    end_at: '2026-11-27T18:00:00.000Z',
    actual_start_at: null,
    contract_expires_at: null,
    units_booked: 1,
    rental_pricing_snapshot: { total: 60, currency: 'CAD', lines: [] },
    client: { id: 'client', user_id: 'client-user', user: { first_name: 'Amina' } },
    business: { id: 'biz', user_id: 'biz-user' },
    rental_location_listing: {
      business_location_id: 'loc-1',
      rental_item: { name: 'JBL Flip 6' },
      business_location: { address: { country: 'CA' } },
    },
    ...over,
  };
}

function momoBooking(over: Row = {}): Row {
  return cardBooking({
    card_pay_at_pickup: false,
    currency: 'XAF',
    total_amount: 12000,
    security_deposit_amount: 0,
    // Douala is UTC+1: 15:00Z = 16:00 wall, 27 Nov.
    start_at: '2026-11-27T09:00:00.000Z',
    end_at: '2026-11-27T21:00:00.000Z',
    rental_location_listing: {
      business_location_id: 'loc-1',
      rental_item: { name: 'JBL Flip 6' },
      business_location: { address: { country: 'CM' } },
    },
    ...over,
  });
}

function harness(initial: Row, opts: { inspection?: Row; walletBalance?: number; flaggedPickup?: boolean } = {}) {
  const svc: any = Object.create(RentalsService.prototype);
  const row: Row = { ...initial };
  const ledger: Array<{ type: string; amount: number; key?: string }> = [];
  const gate = {
    inspectionPolicyVersion: row.inspection_policy_version ?? null,
    pickupAckCurrent: false,
    pickupAcceptedVersionId: null as string | null,
    pickupCurrentVersionId: null as string | null,
    pickupInspectionPending: false,
    ...(opts.inspection ?? {}),
  };
  const snapshot = () => JSON.parse(JSON.stringify(row));
  const record = (type: string) =>
    jest.fn(async (req: { amount: number; idempotencyKey?: string }) => {
      ledger.push({ type, amount: req.amount, key: req.idempotencyKey });
      return { success: true };
    });

  svc.logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn(), debug: jest.fn() };
  svc.logHistory = jest.fn().mockResolvedValue(undefined);
  svc.fetchBooking = jest.fn(async () => snapshot());
  svc.fetchBookingByBookingNumber = jest.fn(async () => snapshot());
  svc.fetchUserContact = jest.fn(async () => ({ email: 'amina@example.com', phone_number: '+237600000000' }));
  svc.casBooking = jest.fn(async (_id: string, from: string[], set: Row) => {
    if (!from.includes(row.status)) return false;
    if (set.status === 'active' && !['authorized', 'paid'].includes(set.payment_status ?? row.payment_status)) {
      throw new Error('rental_start_unpaid');
    }
    Object.assign(row, set);
    return true;
  });
  svc.readInspectionPolicy = jest.fn(async () => row.inspection_policy_version ?? null);
  svc.readInspectionStart = jest.fn(async () => ({ ...gate }));
  svc.notifyRentalBookingReserved = jest.fn().mockResolvedValue(undefined);
  svc.notifyRentalActivated = jest.fn().mockResolvedValue(undefined);
  svc.notifyRentalBookingCancelled = jest.fn().mockResolvedValue(undefined);
  svc.stripeReviewHours = jest.fn(async () => 72);
  svc.stripeWindowFields = jest.fn(async () => ({ mode: 'authorize_upfront', latest_card_end_at: null }));
  svc.requestWindowEnvelope = jest.fn(() => ({ startAt: row.start_at, endAt: row.end_at }));
  svc.deliveryPinService = { clearPinForOrder: jest.fn() };
  svc.inspectionFlags = {
    confirmationsEnabled: jest.fn().mockResolvedValue(false),
    cardChargeAtPickupEnabled: jest.fn().mockResolvedValue(true),
  };
  svc.notificationsService = { sendRentalBookingConfirmedPush: jest.fn() };
  svc.paymentRoutingService = {
    resolveRailForCountry: jest.fn(async (c: string) => (c === 'CA' ? 'stripe' : 'mobile_money')),
    resolveRailForUser: jest.fn(async () => 'mobile_money'),
  };
  svc.hasuraUserService = {
    getUser: jest.fn(async () => ({
      id: 'client-user',
      active_persona: 'client',
      client: { id: 'client' },
      phone_number: '+237600000000',
    })),
  };
  svc.mobilePaymentsDatabaseService = {
    hasPendingRentalBookingPayment: jest.fn().mockResolvedValue(false),
    hasSuccessfulRentalBookingPayment: jest.fn().mockResolvedValue(false),
  };
  svc.stripePaymentsDatabaseService = {
    getPendingRentalBookingPayment: jest.fn().mockResolvedValue(null),
    getTransactionByEntityId: jest.fn().mockResolvedValue(null),
  };
  svc.stripeCheckoutService = {
    createPaymentIntent: jest.fn(async () => ({ clientSecret: 'pi_secret', transactionId: 'stx-1' })),
    createCheckout: jest.fn(async () => ({ paymentUrl: 'https://checkout', transactionId: 'stx-2' })),
  };
  svc.stripeService = { retrievePaymentIntent: jest.fn(async () => ({ client_secret: 'pi_reused' })) };
  svc.stripeCaptureService = {
    cancelOrderPaymentIntent: jest.fn(async () => ({ success: true, skipped: true })),
    refundCapturedPayment: jest.fn(async () => ({ success: true })),
    captureRentalBookingPaymentIntent: jest.fn(async () => ({ success: true, captured: true })),
  };
  svc.initiateRentalBookingPayment = jest.fn().mockResolvedValue(undefined);
  svc.accountsService = {
    registerHoldIfNotExists: record('hold'),
    registerReleaseIfNotExists: record('release'),
    registerPaymentIfNotExists: record('payment'),
    registerDepositIfNotExists: record('deposit'),
    registerWithdrawalIfNotExists: record('withdrawal'),
    registerTransaction: jest.fn(async (req: { amount: number; transactionType: string; idempotencyKey?: string }) => {
      ledger.push({ type: req.transactionType, amount: req.amount, key: req.idempotencyKey });
      return { success: true };
    }),
  };
  svc.hasuraSystemService = {
    getAccount: jest.fn(async () => ({ id: 'acc-client', available_balance: opts.walletBalance ?? 0 })),
    ensureAccountForBusinessLocation: jest.fn(async () => ({ id: 'acc-biz' })),
    executeQuery: jest.fn(async (query: string) => {
      if (String(query).includes('PickupCheckFlagged')) {
        return { rental_inspections: opts.flaggedPickup ? [{ status: 'correction_requested' }] : [] };
      }
      if (String(query).includes('rental_holds')) {
        return { rental_holds: row.__hold ? [row.__hold] : [] };
      }
      return {};
    }),
    executeMutation: jest.fn(async (query: string, vars: Row) => {
      const text = String(query);
      if (text.includes('ReservationFeeCas')) {
        if (!vars.from.includes(row.reservation_fee_status)) return { update_rental_bookings: { affected_rows: 0 } };
        Object.assign(row, vars._set);
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (text.includes('rental_mark_started')) {
        if (row.status !== 'confirmed') return { rental_mark_started: [] };
        if (!['authorized', 'paid'].includes(row.payment_status)) throw new Error('rental_start_unpaid');
        if (row.inspection_policy_version != null && !gate.pickupAckCurrent) return { rental_mark_started: [] };
        Object.assign(row, { status: 'active', actual_start_at: vars.at });
        return { rental_mark_started: [{ id: row.id }] };
      }
      if (text.includes('PatchBooking')) {
        Object.assign(row, vars._set);
        return {};
      }
      return { update_rental_requests_by_pk: { id: 'req-1' } };
    }),
  };
  return { svc, row, ledger, gate };
}

const CA_REQ = { rental_location_listing: { business_location: { address: { country: 'CA' } } } };
const CM_REQ = { rental_location_listing: { business_location: { address: { country: 'CM' } } } };

function authorizedWebhook(amount: number) {
  return { entity_id: 'RB-1', amount };
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] });
  jest.setSystemTime(NOW);
});

afterEach(() => jest.useRealTimers());

describe('reservation fee policy', () => {
  it('is 10% of the rental with a 150 FCFA / 2.00 floor, capped at the total', () => {
    expect(reservationFeeFor({ enabled: true, total: 12000, currency: 'XAF' })).toBe(1200);
    expect(reservationFeeFor({ enabled: true, total: 1000, currency: 'XOF' })).toBe(150);
    expect(reservationFeeFor({ enabled: true, total: 100, currency: 'XAF' })).toBe(100);
    expect(reservationFeeFor({ enabled: true, total: 60, currency: 'CAD' })).toBe(6);
    expect(reservationFeeFor({ enabled: true, total: 12.5, currency: 'CAD' })).toBe(2);
    expect(reservationFeeFor({ enabled: true, total: 33.33, currency: 'USD' })).toBe(3.33);
    expect(reservationFeeFor({ enabled: false, total: 12000, currency: 'XAF' })).toBe(0);
    expect(reservationFeeFor({ enabled: undefined, total: 12000, currency: 'XAF' })).toBe(0);
  });

  it('counts a paid fee toward the total and ignores an unpaid one', () => {
    expect(dueAtPickup({ total: 12000, feeAmount: 1200, feeStatus: 'paid' })).toBe(10800);
    expect(dueAtPickup({ total: 12000, feeAmount: 1200, feeStatus: 'pending' })).toBe(12000);
    expect(dueAtPickup({ total: 60, feeAmount: 6, feeStatus: 'paid' })).toBe(54);
  });

  it('refunds or keeps the fee by the README table', () => {
    const at = (iso: string) => ({ now: new Date(iso), startAt: new Date('2026-11-28T09:00:00Z'), timeZone: 'Africa/Douala' });
    // 27 Nov 22:30 Douala = before the start day.
    expect(feeOutcome({ reason: 'renter_cancel', ...at('2026-11-27T21:30:00Z') })).toBe('refund');
    // 28 Nov 00:30 Douala = the start day.
    expect(feeOutcome({ reason: 'renter_cancel', ...at('2026-11-27T23:30:00Z') })).toBe('forfeit');
    expect(feeOutcome({ reason: 'business_cancel', ...at('2026-11-28T10:00:00Z') })).toBe('refund');
    expect(feeOutcome({ reason: 'not_as_described', ...at('2026-11-28T10:00:00Z') })).toBe('refund');
    expect(feeOutcome({ reason: 'unresolved_flag', ...at('2026-11-28T23:30:00Z') })).toBe('refund');
    expect(feeOutcome({ reason: 'unpaid_expired', ...at('2026-11-28T23:30:00Z') })).toBe('forfeit');
    expect(feeOutcome({ reason: 'no_show', ...at('2026-11-28T23:30:00Z') })).toBe('forfeit');
  });

  it('keeps the ~6-day card limit, counted from pickup', () => {
    const start = new Date('2026-12-20T09:00:00Z');
    const fits = (days: number, reviewHours = 0) =>
      pickupAuthFits({ startAt: start, endAt: new Date(start.getTime() + days * 86_400_000), authWindowDays: 6, reviewHours });
    expect(fits(6)).toBe(true);
    expect(fits(6.5)).toBe(false);
    expect(fits(3, 72)).toBe(true);
    expect(fits(4, 72)).toBe(false);
  });

  it('keeps fee payments on their own entity id', () => {
    expect(reservationFeeEntityId('RB-1')).toBe('fee:RB-1');
    expect(bookingNumberFromFeeEntity('fee:RB-1')).toBe('RB-1');
    expect(bookingNumberFromFeeEntity('RB-1')).toBeNull();
  });
});

describe('1. no inspection: reserve free, pay and start at pickup', () => {
  it('reserves a card booking without any Stripe call', async () => {
    const { svc, row } = harness(cardBooking({ status: 'proposed', payment_timing: 'pay_now', contract_expires_at: '2026-11-28T00:00:00Z' }));
    const result = await svc.acceptProposedBookingByRail({
      bookingId: 'b1', bookingNumber: 'RB-1', requestId: 'req-1', req: CA_REQ, userId: 'client-user',
      stripePaymentMethod: 'payment_sheet',
    });
    expect(result).toMatchObject({ reserved: true, payment_rail: 'stripe' });
    expect(result.payment_intent_client_secret).toBeUndefined();
    expect(row).toMatchObject({ status: 'reserved', payment_timing: 'pay_at_pickup', payment_status: 'pending' });
    expect(svc.stripeCheckoutService.createPaymentIntent).not.toHaveBeenCalled();
    expect(svc.stripeCheckoutService.createCheckout).not.toHaveBeenCalled();
  });

  it('Pay and start authorizes rental + deposit, then the webhook confirms and starts it', async () => {
    const { svc, row } = harness(cardBooking());
    const pay = await svc.startRental('b1', 'payment_sheet');
    expect(pay).toMatchObject({ started: false, paymentPending: true, payment_rail: 'card', amount_due_at_pickup: 60 });
    expect(pay.payment_intent_client_secret).toBe('pi_secret');
    expect(pay.deposit_hold_amount).toBe(180);
    expect(svc.stripeCheckoutService.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 240, captureMethod: 'manual', entityId: 'RB-1' })
    );
    expect(row.status).toBe('reserved');
    expect(row.actual_start_at).toBeNull();

    await svc.processRentalBookingAuthorization(authorizedWebhook(240));
    expect(row).toMatchObject({ status: 'active', payment_status: 'authorized', authorized_amount: 240, payment_timing: 'pay_at_pickup' });
    expect(row.actual_start_at).toBe(NOW.toISOString());
    expect(svc.notifyRentalActivated).toHaveBeenCalled();
  });

  it('web gets a hosted Checkout instead of a PaymentSheet', async () => {
    const { svc } = harness(cardBooking());
    const pay = await svc.startRental('b1');
    expect(pay.checkout_url).toBe('https://checkout');
    expect(svc.stripeCheckoutService.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amount: 240, captureMethod: 'manual' }));
  });

  it('Pay and start is closed before the start day', async () => {
    const { svc } = harness(cardBooking({ start_at: '2026-11-28T09:00:00.000Z', end_at: '2026-11-28T18:00:00.000Z' }));
    await expect(svc.startRental('b1', 'payment_sheet')).rejects.toBeInstanceOf(HttpException);
    expect(svc.stripeCheckoutService.createPaymentIntent).not.toHaveBeenCalled();
  });
});

describe('2. inspection accepted', () => {
  it('refuses to pay before the renter accepts the check (409)', async () => {
    const { svc } = harness(cardBooking({ inspection_policy_version: 1 }), {
      inspection: { inspectionPolicyVersion: 1, pickupCurrentVersionId: 'v1', pickupInspectionPending: true },
    });
    await expect(svc.startRental('b1', 'payment_sheet')).rejects.toMatchObject({ status: 409 });
    expect(svc.stripeCheckoutService.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('accept writes the ack, authorizes, and the rental starts on the webhook', async () => {
    const { svc, row, gate } = harness(cardBooking({ inspection_policy_version: 1 }), {
      inspection: { inspectionPolicyVersion: 1, pickupCurrentVersionId: 'v1' },
    });
    svc.writePickupAccept = jest.fn(async () => {
      gate.pickupAckCurrent = true;
      gate.pickupAcceptedVersionId = 'v1';
    });
    const pay = await svc.acceptAndStartRental('b1', 'v1', 'payment_sheet');
    expect(svc.writePickupAccept).toHaveBeenCalledWith('b1', 'v1', 'client-user');
    expect(pay).toMatchObject({ accepted: true, started: false, paymentPending: true, payment_rail: 'card' });
    await svc.processRentalBookingAuthorization(authorizedWebhook(240));
    expect(row.status).toBe('active');
  });

  it('never starts a confirmed booking that is not paid (trigger mirror)', async () => {
    const { svc, row } = harness(cardBooking({ status: 'confirmed', payment_status: 'pending' }));
    await expect(svc.markInspectionOrLegacyStart('b1')).rejects.toMatchObject({ status: 409 });
    expect(row.status).toBe('confirmed');
  });
});

describe('3. inspection rejected (flag)', () => {
  it('keeps Pay and start closed while the check is flagged', async () => {
    const { svc } = harness(cardBooking({ inspection_policy_version: 1 }), {
      inspection: { inspectionPolicyVersion: 1, pickupCurrentVersionId: 'v1', pickupAckCurrent: false },
    });
    await expect(svc.startRental('b1', 'payment_sheet')).rejects.toMatchObject({ status: 409 });
  });

  it('refunds the fee when the flag is still open at the end of the start day', async () => {
    const { svc, row, ledger } = harness(
      momoBooking({ reservation_fee_amount: 1200, reservation_fee_status: 'paid', reservation_fee_ref: 'ref-1', reservation_fee_rail: 'mobile_money' }),
      { flaggedPickup: true }
    );
    const outcome = await svc.settleReservationFeeAfterExpiry(row);
    expect(outcome).toBe('refund');
    expect(row.reservation_fee_status).toBe('refunded');
    expect(ledger.map((l) => l.type)).toEqual(['release']);
  });
});

/** The real end-of-day job (RentalsCronService.expireReservedRentalBookings) over the harness row. */
function cronOver(h: ReturnType<typeof harness>) {
  const history: Row[] = [];
  const pushes: Row[] = [];
  const hasura = {
    executeQuery: jest.fn(async (query: string, vars: Row) => {
      if (query === Q.LIST_EXPIRED_RESERVED_RENTAL_BOOKINGS) return { rental_bookings: h.row.status === 'reserved' ? [{ id: h.row.id }] : [] };
      if (query === Q.GET_RENTAL_BOOKING_FULL) return { rental_bookings_by_pk: JSON.parse(JSON.stringify(h.row)) };
      return h.svc.hasuraSystemService.executeQuery(query, vars);
    }),
    executeMutation: jest.fn(async (query: string, vars: Row) => {
      if (query === Q.CAS_UPDATE_RENTAL_BOOKING) {
        if (!vars.from.includes(h.row.status)) return { update_rental_bookings: { affected_rows: 0 } };
        Object.assign(h.row, vars.set);
        return { update_rental_bookings: { affected_rows: 1 } };
      }
      if (query === Q.INSERT_RENTAL_STATUS_HISTORY) {
        history.push(vars.object);
        return {};
      }
      return h.svc.hasuraSystemService.executeMutation(query, vars);
    }),
  };
  const notifications = { sendRentalBookingCancelledPush: jest.fn(async (p: Row) => void pushes.push(p)) };
  const cron = new RentalsCronService(hasura as any, notifications as any, {} as any, h.svc, {} as any, {} as any);
  return { cron, history, pushes };
}

describe('3b. unresolved flag at 23:59 on the start day (cron)', () => {
  // Douala UTC+1: 23:30Z on 27 Nov = 00:30 on 28 Nov, past the 27 Nov start day.
  const AFTER_START_DAY = new Date('2026-11-27T23:30:00.000Z');
  const paidFee = { reservation_fee_amount: 1200, reservation_fee_status: 'paid', reservation_fee_ref: 'ref-1', reservation_fee_rail: 'mobile_money' };

  it('cancels the booking and refunds the fee when the flag was never fixed', async () => {
    jest.setSystemTime(AFTER_START_DAY);
    const h = harness(momoBooking({ ...paidFee, inspection_policy_version: 1, pickup_inspection_pending: true }), { flaggedPickup: true });
    const { cron, history, pushes } = cronOver(h);
    await expect(cron.expireReservedRentalBookings()).resolves.toBe(1);
    expect(h.row).toMatchObject({ status: 'cancelled', payment_status: 'cancelled', reservation_fee_status: 'refunded' });
    expect(h.ledger.map((l) => l.type)).toEqual(['release']);
    expect(history[0].notes).toMatch(/flag not fixed.*refunded/);
    expect(pushes).toHaveLength(2);
  });

  it('still pauses while the business photos wait for the renter (not flagged)', async () => {
    jest.setSystemTime(AFTER_START_DAY);
    const h = harness(momoBooking({ ...paidFee, inspection_policy_version: 1, pickup_inspection_pending: true }), { flaggedPickup: false });
    const { cron } = cronOver(h);
    await expect(cron.expireReservedRentalBookings()).resolves.toBe(0);
    expect(h.row).toMatchObject({ status: 'reserved', reservation_fee_status: 'paid' });
  });

  it('does nothing before 23:59 on the start day, even when flagged', async () => {
    jest.setSystemTime(new Date('2026-11-27T21:00:00.000Z'));
    const h = harness(momoBooking({ ...paidFee, inspection_policy_version: 1, pickup_inspection_pending: true }), { flaggedPickup: true });
    const { cron } = cronOver(h);
    await expect(cron.expireReservedRentalBookings()).resolves.toBe(0);
    expect(h.row.status).toBe('reserved');
  });

  it('plain unpaid at the end of the start day still keeps the fee', async () => {
    jest.setSystemTime(AFTER_START_DAY);
    const h = harness(momoBooking({ ...paidFee, reservation_fee_rail: 'wallet' }));
    const { cron } = cronOver(h);
    await expect(cron.expireReservedRentalBookings()).resolves.toBe(1);
    expect(h.row).toMatchObject({ status: 'cancelled', reservation_fee_status: 'forfeited' });
  });

  it('a renter cancelling on the start day while the flag is open gets the fee back', async () => {
    const h = harness(momoBooking({ ...paidFee, reservation_fee_rail: 'wallet', inspection_policy_version: 1, pickup_inspection_pending: true }), { flaggedPickup: true });
    await h.svc.cancelRentalBooking('b1');
    expect(h.row).toMatchObject({ status: 'cancelled', reservation_fee_status: 'refunded' });
  });
});

describe('4. payment failure', () => {
  it('a declined card leaves the booking reserved and the retry reuses the open PaymentIntent', async () => {
    const { svc, row } = harness(cardBooking());
    await svc.startRental('b1', 'payment_sheet');
    // Decline: Stripe marks the tx failed or leaves it requiring a payment method. No webhook confirms.
    expect(row).toMatchObject({ status: 'reserved', payment_status: 'pending', actual_start_at: null });
    svc.stripePaymentsDatabaseService.getPendingRentalBookingPayment.mockResolvedValue({ id: 'stx-1', stripe_payment_intent_id: 'pi_1' });
    const retry = await svc.startRental('b1', 'payment_sheet');
    expect(retry.payment_intent_client_secret).toBe('pi_reused');
    expect(svc.stripeCheckoutService.createPaymentIntent).toHaveBeenCalledTimes(1);
  });

  it('a Mobile Money failure leaves the booking reserved; unpaid at the end of the start day keeps the fee', async () => {
    const { svc, row, ledger } = harness(
      momoBooking({ reservation_fee_amount: 1200, reservation_fee_status: 'paid', reservation_fee_ref: 'ref-1', reservation_fee_rail: 'mobile_money' })
    );
    const pay = await svc.startRental('b1');
    expect(pay).toMatchObject({ payment_rail: 'mobile_money', paymentPending: true, amount_due_at_pickup: 10800 });
    expect(row.status).toBe('reserved');
    const outcome = await svc.settleReservationFeeAfterExpiry(row);
    expect(outcome).toBe('forfeit');
    expect(row.reservation_fee_status).toBe('forfeited');
    expect(ledger.map((l) => `${l.type}:${l.amount}`)).toEqual(['release:1200', 'payment:1200', 'deposit:1200']);
  });

  it('pushes only the remainder (rental - fee) at pickup', async () => {
    const { svc } = harness(momoBooking({ reservation_fee_amount: 1200, reservation_fee_status: 'paid', reservation_fee_ref: 'ref-1' }));
    await svc.pushMomoPickupPayment(await svc.fetchBooking('b1'), 'acc-client', 'client-user');
    expect(svc.initiateRentalBookingPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 10800, purpose: 'contract' }));
  });
});

describe('5. unpaid booking cancel', () => {
  it('renter cancel before the start day refunds the fee (card fee back to the card)', async () => {
    const { svc, row, ledger } = harness(
      cardBooking({
        start_at: '2026-11-29T09:00:00.000Z',
        end_at: '2026-11-29T18:00:00.000Z',
        reservation_fee_amount: 6,
        reservation_fee_status: 'paid',
        reservation_fee_ref: 'ref-1',
        reservation_fee_rail: 'card',
      })
    );
    await svc.cancelRentalBooking('b1');
    expect(row).toMatchObject({ status: 'cancelled', payment_status: 'cancelled', reservation_fee_status: 'refunded' });
    expect(svc.stripeCaptureService.refundCapturedPayment).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: 'fee:RB-1' }));
    expect(ledger.map((l) => l.type)).toEqual(['release', 'withdrawal']);
  });

  it('renter cancel on the start day keeps the fee for the business', async () => {
    const { svc, row } = harness(
      momoBooking({ reservation_fee_amount: 1200, reservation_fee_status: 'paid', reservation_fee_ref: 'ref-1', reservation_fee_rail: 'wallet' })
    );
    await svc.cancelRentalBooking('b1');
    expect(row.reservation_fee_status).toBe('forfeited');
  });

  it('business cancel always refunds', async () => {
    const { svc, row } = harness(
      momoBooking({ reservation_fee_amount: 1200, reservation_fee_status: 'paid', reservation_fee_ref: 'ref-1', reservation_fee_rail: 'wallet' })
    );
    svc.hasuraUserService.getUser.mockResolvedValue({ id: 'biz-user', active_persona: 'business', business: { id: 'biz' } });
    await svc.cancelRentalBooking('b1');
    expect(row.reservation_fee_status).toBe('refunded');
  });

  it('a fee refund failure puts the booking back so the cancel can be retried', async () => {
    const { svc, row } = harness(
      cardBooking({
        start_at: '2026-11-29T09:00:00.000Z',
        end_at: '2026-11-29T18:00:00.000Z',
        reservation_fee_amount: 6,
        reservation_fee_status: 'paid',
        reservation_fee_ref: 'ref-1',
        reservation_fee_rail: 'card',
      })
    );
    svc.stripeCaptureService.refundCapturedPayment.mockResolvedValue({ success: false });
    await expect(svc.cancelRentalBooking('b1')).rejects.toBeInstanceOf(HttpException);
    expect(row).toMatchObject({ status: 'reserved', reservation_fee_status: 'paid' });
  });
});

describe('reserve with a fee', () => {
  const proposed = (over: Row = {}) =>
    momoBooking({
      status: 'proposed',
      payment_timing: 'pay_now',
      contract_expires_at: '2026-11-28T00:00:00Z',
      reservation_fee_amount: 1200,
      reservation_fee_ref: 'ref-1',
      ...over,
    });

  it('wallet covers the fee: hold it and reserve in one tap', async () => {
    const { svc, row, ledger } = harness(proposed(), { walletBalance: 5000 });
    const result = await svc.acceptProposedBookingByRail({ bookingId: 'b1', bookingNumber: 'RB-1', requestId: 'req-1', req: CM_REQ, userId: 'client-user' });
    expect(result.reserved).toBe(true);
    expect(row).toMatchObject({ status: 'reserved', reservation_fee_status: 'paid', reservation_fee_rail: 'wallet' });
    expect(ledger).toEqual([expect.objectContaining({ type: 'hold', amount: 1200 })]);
  });

  it('Mobile Money: push the fee, stay proposed, reserve on the callback', async () => {
    const { svc, row, ledger } = harness(proposed());
    const result = await svc.acceptProposedBookingByRail({ bookingId: 'b1', bookingNumber: 'RB-1', requestId: 'req-1', req: CM_REQ, userId: 'client-user' });
    expect(result).toMatchObject({ paymentPending: true, payment_rail: 'mobile_money', reservation_fee: { amount: 1200 } });
    expect(svc.initiateRentalBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1200, purpose: 'reservation_fee', entityId: 'fee:RB-1' })
    );
    expect(row.status).toBe('proposed');
    await svc.processRentalBookingPayment({ entity_id: 'fee:RB-1', amount: 1200 });
    expect(row).toMatchObject({ status: 'reserved', reservation_fee_status: 'paid' });
    expect(ledger).toEqual([expect.objectContaining({ type: 'hold', amount: 1200 })]);
  });

  it('card: a PaymentIntent for the fee only (automatic capture)', async () => {
    const { svc, row } = harness(cardBooking({ status: 'proposed', payment_timing: 'pay_now', contract_expires_at: '2026-11-28T00:00:00Z', reservation_fee_amount: 6, reservation_fee_ref: 'ref-1' }));
    const result = await svc.acceptProposedBookingByRail({
      bookingId: 'b1', bookingNumber: 'RB-1', requestId: 'req-1', req: CA_REQ, userId: 'client-user', stripePaymentMethod: 'payment_sheet',
    });
    expect(result.payment_intent_client_secret).toBe('pi_secret');
    expect(svc.stripeCheckoutService.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 6, captureMethod: 'automatic', entityId: 'fee:RB-1' })
    );
    expect(row).toMatchObject({ status: 'proposed', reservation_fee_rail: 'card', reservation_fee_status: 'pending' });
    await svc.processRentalBookingPayment({ entity_id: 'fee:RB-1', amount: 6 });
    expect(row.status).toBe('reserved');
    // Pay and start then authorizes 60 - 6 + 180.
    await svc.startRental('b1', 'payment_sheet');
    expect(svc.stripeCheckoutService.createPaymentIntent).toHaveBeenLastCalledWith(
      expect.objectContaining({ amount: 234, captureMethod: 'manual', entityId: 'RB-1' })
    );
  });

  it('a fee that lands after the offer expired is refunded', async () => {
    const { svc, row } = harness(proposed({ contract_expires_at: '2026-11-27T14:00:00Z', reservation_fee_rail: 'mobile_money', reservation_fee_status: 'pending' }));
    await svc.processRentalBookingPayment({ entity_id: 'fee:RB-1', amount: 1200 });
    expect(row.status).toBe('proposed');
    expect(row.reservation_fee_status).toBe('refunded');
  });
});

describe('6. return check and settlement', () => {
  it('card: captures rental - fee (+ overtime from the deposit) and pays the fee to the business', async () => {
    const { svc, row, ledger } = harness(
      cardBooking({
        status: 'awaiting_return',
        payment_status: 'authorized',
        authorized_amount: 234,
        reservation_fee_amount: 6,
        reservation_fee_status: 'paid',
        reservation_fee_ref: 'ref-1',
        reservation_fee_rail: 'card',
      })
    );
    svc.resolveBookingHourlyRate = jest.fn(() => 10);
    // 19:10 Toronto wall clock (#885 reads the return instant on the listing clock).
    const settlement = svc.computeRentalSettlement(row, '2026-11-28T00:10:00.000Z');
    expect(settlement).toMatchObject({ contract: 54, overtimeAmount: 20, stripeCharge: 74 });
    await svc.settleStripeAuthorizedBooking(row, settlement);
    expect(svc.stripeCaptureService.captureRentalBookingPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amountToCapture: 74 }));
    expect(row.reservation_fee_status).toBe('applied');
    expect(ledger.filter((l) => String(l.key).includes(':fee:')).map((l) => `${l.type}:${l.amount}`)).toEqual([
      'release:6',
      'payment:6',
      'deposit:6',
    ]);
  });

  it('wallet: releases the fee hold before the contract payment of the full total', async () => {
    const { svc, row, ledger } = harness(
      momoBooking({
        status: 'awaiting_return',
        payment_status: 'paid',
        reservation_fee_amount: 1200,
        reservation_fee_status: 'paid',
        reservation_fee_ref: 'ref-1',
        reservation_fee_rail: 'mobile_money',
      })
    );
    row.__hold = { id: 'h1', client_hold_amount: 10800, status: 'active', ledger_attempt_id: 'att-1' };
    await svc.settleBooking(row);
    const moves = ledger.map((l) => `${l.type}:${l.amount}`);
    expect(moves).toEqual(['release:10800', 'release:1200', 'payment:12000', 'deposit:12000']);
    expect(row.reservation_fee_status).toBe('applied');
  });
});

describe('7. bookings created before this change keep their path', () => {
  it('a card offer created before (card_pay_at_pickup=false) still authorizes rental + deposit at reserve', async () => {
    const { svc, row } = harness(cardBooking({ status: 'proposed', payment_timing: 'pay_now', card_pay_at_pickup: false, contract_expires_at: '2026-11-28T00:00:00Z' }));
    svc.assertStripeRentalEndWithinAuthWindow = jest.fn();
    svc.assertEnrolledStripeReviewWindow = jest.fn();
    svc.knownInspected = jest.fn(async () => undefined);
    svc.snapshotSecurityDeposit = jest.fn(() => 180);
    const result = await svc.acceptProposedBookingByRail({
      bookingId: 'b1', bookingNumber: 'RB-1', requestId: 'req-1', userId: 'client-user', stripePaymentMethod: 'payment_sheet',
      req: { rental_pricing_snapshot: { total: 60, currency: 'CAD' }, rental_location_listing: { business_location: { address: { country: 'CA' } } } },
    });
    expect(result.payment_intent_client_secret).toBe('pi_secret');
    expect(svc.stripeCheckoutService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 240, captureMethod: 'manual' }));
    expect(row.status).toBe('proposed');
    await svc.processRentalBookingAuthorization(authorizedWebhook(240));
    expect(row).toMatchObject({ status: 'confirmed', payment_status: 'authorized', payment_timing: 'pay_now' });
  });

  it('a confirmed + authorized booking starts at the pickup tap with no new charge', async () => {
    const { svc, row } = harness(cardBooking({ status: 'confirmed', payment_status: 'authorized', payment_timing: 'pay_now', card_pay_at_pickup: false }));
    const result = await svc.startRental('b1', 'payment_sheet');
    expect(result).toMatchObject({ started: true, payment_rail: 'card', amount_due_at_pickup: 0 });
    expect(svc.stripeCheckoutService.createPaymentIntent).not.toHaveBeenCalled();
    expect(row.status).toBe('active');
  });

  it('a reserved Mobile Money booking with no fee pushes the full total, as before', async () => {
    const { svc } = harness(momoBooking());
    const result = await svc.startRental('b1');
    expect(result).toMatchObject({ payment_rail: 'mobile_money', amount_due_at_pickup: 12000 });
    expect(svc.initiateRentalBookingPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 12000 }));
  });

  it('a no-fee booking never touches the fee ledger on cancel or settle', async () => {
    const { svc, ledger } = harness(momoBooking({ start_at: '2026-11-29T09:00:00.000Z', end_at: '2026-11-29T21:00:00.000Z' }));
    await svc.cancelRentalBooking('b1');
    expect(ledger).toEqual([]);
    expect(svc.hasuraSystemService.executeMutation.mock.calls.some((c: unknown[]) => String(c[0]).includes('ReservationFeeCas'))).toBe(false);
  });
});

describe('the path is decided once, at booking creation', () => {
  const req = (country: string, feeOn: boolean) => ({
    rental_location_listing: { reservation_fee_enabled: feeOn, business_location: { address: { country } } },
  });

  it('card market with the flag on: card pay at pickup, plus the listing fee', async () => {
    const { svc, row } = harness(cardBooking({ status: 'proposed', card_pay_at_pickup: false }));
    await svc.stampReservePath('b1', req('CA', true), 60, 'CAD');
    expect(row).toMatchObject({ card_pay_at_pickup: true, reservation_fee_amount: 6 });
    expect(row.reservation_fee_ref).toEqual(expect.any(String));
  });

  it('card market with the flag off: legacy path, no fee', async () => {
    const { svc, row } = harness(cardBooking({ status: 'proposed', card_pay_at_pickup: false }));
    svc.inspectionFlags.cardChargeAtPickupEnabled.mockResolvedValue(false);
    await svc.stampReservePath('b1', req('CA', true), 60, 'CAD');
    expect(row).toMatchObject({ card_pay_at_pickup: false, reservation_fee_amount: 0 });
    expect(svc.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('Mobile Money market: fee only when the listing turned it on', async () => {
    const on = harness(momoBooking({ status: 'proposed' }));
    await on.svc.stampReservePath('b1', req('CM', true), 12000, 'XAF');
    expect(on.row).toMatchObject({ card_pay_at_pickup: false, reservation_fee_amount: 1200 });
    const off = harness(momoBooking({ status: 'proposed' }));
    await off.svc.stampReservePath('b1', req('CM', false), 12000, 'XAF');
    expect(off.svc.hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('a later flag change does not move a booking already created', async () => {
    const { svc, row } = harness(cardBooking({ status: 'proposed', card_pay_at_pickup: true, contract_expires_at: '2026-11-28T00:00:00Z' }));
    svc.inspectionFlags.cardChargeAtPickupEnabled.mockResolvedValue(false);
    const result = await svc.acceptProposedBookingByRail({
      bookingId: 'b1', bookingNumber: 'RB-1', requestId: 'req-1', req: CA_REQ, userId: 'client-user', stripePaymentMethod: 'payment_sheet',
    });
    expect(result.reserved).toBe(true);
    expect(row.status).toBe('reserved');
    expect(svc.inspectionFlags.cardChargeAtPickupEnabled).not.toHaveBeenCalled();
  });

  it('card pay at pickup still refuses rentals longer than the card limit', async () => {
    const { svc } = harness(cardBooking({
      status: 'proposed',
      contract_expires_at: '2026-11-28T00:00:00Z',
      start_at: '2026-12-01T09:00:00.000Z',
      end_at: '2026-12-09T09:00:00.000Z',
    }));
    await expect(
      svc.acceptProposedBookingByRail({ bookingId: 'b1', bookingNumber: 'RB-1', requestId: 'req-1', req: CA_REQ, userId: 'client-user' })
    ).rejects.toBeInstanceOf(HttpException);
  });
});
