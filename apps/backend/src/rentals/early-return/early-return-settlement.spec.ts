import { RentalsService } from '../rentals.service';
import { commissionOffStub } from '../../rental-commission/rental-commission.test-util';

/**
 * Money flow for an early return (Samuel, 26 Nov): the renter pays the full
 * booked price, the deposit is released on a good return, and the settlement
 * uses the renter's "Return early" tap unless the business corrects it.
 * Toronto (UTC−5, card) and Douala (UTC+1, MoMo) because end_at is listing
 * wall clock while the return is a real instant.
 */

const TORONTO = {
  country: 'CA',
  currency: 'CAD',
  // Booked 2:00 PM – 6:00 PM on the Toronto clock (wall clock as UTC components).
  start_at: '2026-11-26T14:00:00.000Z',
  end_at: '2026-11-26T18:00:00.000Z',
  // Picked up 2:00 PM Toronto = 19:00Z.
  actual_start_at: '2026-11-26T19:00:00.000Z',
  // "Return early" tapped at 3:40 PM Toronto = 20:40Z; business confirms 3:52 PM.
  reportedAt: '2026-11-26T20:40:00.000Z',
  confirmAt: '2026-11-26T20:52:00.000Z',
  // Business corrects to 3:30 PM Toronto = 20:30Z.
  corrected: '2026-11-26T20:30:00.000Z',
};

const DOUALA = {
  country: 'CM',
  currency: 'XAF',
  start_at: '2026-11-26T14:00:00.000Z',
  end_at: '2026-11-26T18:00:00.000Z',
  // Picked up 2:00 PM Douala = 13:00Z.
  actual_start_at: '2026-11-26T13:00:00.000Z',
  // "Return early" tapped at 3:40 PM Douala = 14:40Z.
  reportedAt: '2026-11-26T14:40:00.000Z',
  confirmAt: '2026-11-26T14:52:00.000Z',
  // Business corrects to 3:30 PM Douala = 14:30Z.
  corrected: '2026-11-26T14:30:00.000Z',
};

type Market = typeof TORONTO;

function cardBooking(m: Market, overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    booking_number: 'RB-1',
    status: 'active',
    business_id: 'biz',
    client_id: 'c1',
    payment_status: 'authorized',
    currency: m.currency,
    total_amount: 60,
    security_deposit_amount: 180,
    authorized_amount: 240,
    units_booked: 1,
    start_at: m.start_at,
    end_at: m.end_at,
    actual_start_at: m.actual_start_at,
    actual_end_at: null,
    renter_reported_returned_at: m.reportedAt,
    client: { user_id: 'client-user' },
    rental_location_listing: {
      base_price_per_hour: 15,
      business_location: { address: { country: m.country } },
    },
    rental_pricing_snapshot: {
      total: 60,
      currency: m.currency,
      ratePerHour: 15,
      lines: [{ kind: 'hourly', startAt: m.start_at, endAt: m.end_at, billableHours: 4, ratePerHour: 15, subtotal: 60 }],
    },
    ...overrides,
  };
}

function momoBooking(m: Market, overrides: Record<string, unknown> = {}) {
  return cardBooking(m, {
    payment_status: 'paid',
    total_amount: 45000,
    security_deposit_amount: 0,
    authorized_amount: 0,
    rental_location_listing: {
      base_price_per_hour: 11250,
      business_location: { address: { country: m.country } },
    },
    rental_pricing_snapshot: {
      total: 45000,
      currency: m.currency,
      ratePerHour: 11250,
      lines: [{ kind: 'hourly', startAt: m.start_at, endAt: m.end_at, billableHours: 4, ratePerHour: 11250, subtotal: 45000 }],
    },
    ...overrides,
  });
}

function service(booking: Record<string, unknown>) {
  const svc: any = Object.create(RentalsService.prototype);
  svc.commission = commissionOffStub();
  svc.logger = { warn: jest.fn(), debug: jest.fn(), error: jest.fn(), log: jest.fn() };
  svc.hasuraUserService = {
    getUser: jest.fn().mockResolvedValue({ id: 'business-user', active_persona: 'business', business: { id: 'biz' } }),
  };
  svc.hasuraSystemService = {
    executeQuery: jest.fn().mockResolvedValue({ rental_bookings_by_pk: { inspection_policy_version: null } }),
    executeMutation: jest.fn(async (_q: string, vars: { at: string }) => ({
      update_rental_bookings: { returning: [{ actual_end_at: vars.at }] },
    })),
    getAccount: jest.fn().mockResolvedValue({ id: 'acc', available_balance: 0 }),
  };
  svc.fetchBooking = jest.fn().mockResolvedValue(booking);
  svc.casBooking = jest.fn().mockResolvedValue(true);
  svc.logHistory = jest.fn();
  svc.deliveryPinService = { clearPinForOrder: jest.fn() };
  svc.stripeCaptureService = {
    captureRentalBookingPaymentIntent: jest.fn().mockResolvedValue({ success: true }),
  };
  svc.creditClientWalletForStripeCapture = jest.fn();
  svc.registerRentalProceedsLedger = jest.fn();
  svc.patchBooking = jest.fn();
  svc.settleBooking = jest.fn();
  svc.deferReturnForOvertimePayment = jest.fn();
  return svc;
}

function stampedAt(svc: any): string {
  const call = svc.hasuraSystemService.executeMutation.mock.calls[0];
  return call[1].at;
}

afterEach(() => jest.useRealTimers());

describe('early return · card (Toronto, UTC−5)', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(TORONTO.confirmAt)));

  it('captures exactly the full price and voids the deposit, at the renter’s report time', async () => {
    const svc = service(cardBooking(TORONTO));
    const result = await svc.confirmRentalReturn('b1');
    expect(stampedAt(svc)).toBe(TORONTO.reportedAt);
    expect(result).toEqual({ success: true, overtimeAmount: 0 });
    expect(svc.stripeCaptureService.captureRentalBookingPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amountToCapture: 60 })
    );
    // 240 authorized − 60 captured: the 180 deposit is released with the rest of the hold.
    expect(svc.patchBooking).toHaveBeenCalledWith('b1', {
      captured_amount: 60,
      overtime_amount: 0,
      payment_status: 'paid',
    });
    expect(svc.registerRentalProceedsLedger).toHaveBeenCalledWith(expect.anything(), 60, 'Stripe capture', 0);
  });

  it('uses the business-corrected time (listing clock → instant) and still charges only the price', async () => {
    const svc = service(cardBooking(TORONTO));
    await svc.confirmRentalReturn('b1', TORONTO.corrected);
    expect(stampedAt(svc)).toBe(TORONTO.corrected);
    expect(svc.stripeCaptureService.captureRentalBookingPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amountToCapture: 60 })
    );
  });

  it('ends it with Item returned (no renter report): time defaults to now, no overtime', async () => {
    const svc = service(cardBooking(TORONTO, { renter_reported_returned_at: null }));
    await svc.confirmRentalReturn('b1');
    expect(stampedAt(svc)).toBe(TORONTO.confirmAt);
    expect(svc.patchBooking).toHaveBeenCalledWith('b1', expect.objectContaining({ captured_amount: 60, overtime_amount: 0 }));
  });
});

describe('early return · MoMo (Douala, UTC+1)', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(DOUALA.confirmAt)));

  it('settles the full contract to the business with no overtime and no refund', async () => {
    const booking = momoBooking(DOUALA);
    const svc = service(booking);
    const result = await svc.confirmRentalReturn('b1');
    expect(stampedAt(svc)).toBe(DOUALA.reportedAt);
    expect(result).toEqual({ success: true, overtimeAmount: 0 });
    expect(svc.settleBooking).toHaveBeenCalledWith(booking);
    expect(svc.patchBooking).not.toHaveBeenCalled();
    expect(svc.deferReturnForOvertimePayment).not.toHaveBeenCalled();
    expect(svc.stripeCaptureService.captureRentalBookingPaymentIntent).not.toHaveBeenCalled();
  });

  it('uses the business-corrected time', async () => {
    const svc = service(momoBooking(DOUALA));
    await svc.confirmRentalReturn('b1', DOUALA.corrected);
    expect(stampedAt(svc)).toBe(DOUALA.corrected);
    expect(svc.settleBooking).toHaveBeenCalledTimes(1);
  });
});

describe('early return · card in Douala and MoMo-style wallet in Toronto', () => {
  it('Douala card: full price captured, deposit released', async () => {
    jest.useFakeTimers().setSystemTime(new Date(DOUALA.confirmAt));
    const svc = service(cardBooking(DOUALA));
    await svc.confirmRentalReturn('b1');
    expect(svc.stripeCaptureService.captureRentalBookingPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amountToCapture: 60 })
    );
  });

  it('Toronto wallet-held: settles the contract, no overtime push', async () => {
    jest.useFakeTimers().setSystemTime(new Date(TORONTO.confirmAt));
    const svc = service(momoBooking(TORONTO));
    const result = await svc.confirmRentalReturn('b1');
    expect(result).toEqual({ success: true, overtimeAmount: 0 });
    expect(svc.settleBooking).toHaveBeenCalledTimes(1);
    expect(svc.deferReturnForOvertimePayment).not.toHaveBeenCalled();
  });
});

describe('returnSettlement', () => {
  it('Toronto: a 3:40 PM return on a 2–6 PM booking owes no overtime', () => {
    const svc: any = Object.create(RentalsService.prototype);
    svc.commission = commissionOffStub();
    const s = svc.returnSettlement(cardBooking(TORONTO), TORONTO.reportedAt);
    expect(s).toEqual(expect.objectContaining({ contract: 60, overtimeHours: 0, overtimeAmount: 0, stripeCharge: 60 }));
  });

  it('Douala: a 3:40 PM return owes no overtime', () => {
    const svc: any = Object.create(RentalsService.prototype);
    svc.commission = commissionOffStub();
    const s = svc.returnSettlement(momoBooking(DOUALA), DOUALA.reportedAt);
    expect(s).toEqual(expect.objectContaining({ contract: 45000, overtimeAmount: 0 }));
  });

  it('keeps overtime for a return after the due (Douala 7:30 PM = 18:30Z)', () => {
    const svc: any = Object.create(RentalsService.prototype);
    svc.commission = commissionOffStub();
    const s = svc.returnSettlement(momoBooking(DOUALA), '2026-11-26T18:30:00.000Z');
    expect(s.overtimeAmount).toBeGreaterThan(0);
  });
});
