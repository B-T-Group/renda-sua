import { HttpException } from '@nestjs/common';
import { RentalsService } from './rentals.service';

/**
 * Focused tests for the rental deposit / settlement math and rail rules.
 * The helpers under test are pure w.r.t. the service instance, so we invoke
 * them on a bare prototype object without wiring the full Nest module.
 */
const svc: any = Object.create(RentalsService.prototype);

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    total_amount: 160,
    security_deposit_amount: 320,
    units_booked: 1,
    end_at: '2026-07-17T12:00:00.000Z',
    rental_pricing_snapshot: {
      total: 160,
      currency: 'XAF',
      ratePerHour: 40,
      lines: [
        {
          kind: 'hourly',
          startAt: '2026-07-17T08:00:00.000Z',
          endAt: '2026-07-17T12:00:00.000Z',
          billableHours: 4,
          ratePerHour: 40,
          subtotal: 160,
        },
      ],
    },
    ...overrides,
  };
}

describe('computeRentalSettlement', () => {
  it('charges only the contract on an on-time return', () => {
    const s = svc.computeRentalSettlement(
      makeBooking(),
      '2026-07-17T12:00:00.000Z'
    );
    expect(s.contract).toBe(160);
    expect(s.overtimeHours).toBe(0);
    expect(s.overtimeAmount).toBe(0);
    expect(s.stripeCharge).toBe(160);
  });

  it('still charges the full contract on an early return', () => {
    const s = svc.computeRentalSettlement(
      makeBooking(),
      '2026-07-17T10:00:00.000Z'
    );
    expect(s.overtimeAmount).toBe(0);
    expect(s.stripeCharge).toBe(160);
  });

  it('bills ceil(late hours) x hourly rate as overtime', () => {
    // 2h10m late -> 3 overtime hours
    const s = svc.computeRentalSettlement(
      makeBooking(),
      '2026-07-17T14:10:00.000Z'
    );
    expect(s.overtimeHours).toBe(3);
    expect(s.overtimeAmount).toBe(120);
    expect(s.stripeCharge).toBe(280);
  });

  it('caps the Stripe overtime portion at the security deposit', () => {
    const s = svc.computeRentalSettlement(
      makeBooking({ security_deposit_amount: 40 }),
      '2026-07-17T20:00:00.000Z' // 8h late -> 320 overtime, deposit 40
    );
    expect(s.overtimeAmount).toBe(320);
    expect(s.stripeCharge).toBe(200); // contract 160 + capped 40
  });

  it('multiplies overtime by units booked', () => {
    const s = svc.computeRentalSettlement(
      makeBooking({ units_booked: 2 }),
      '2026-07-17T13:00:00.000Z'
    );
    expect(s.overtimeAmount).toBe(80);
  });

  it('falls back to the listing hourly rate when the snapshot has none', () => {
    const s = svc.computeRentalSettlement(
      makeBooking({
        rental_pricing_snapshot: { total: 160, currency: 'XAF' },
        rental_location_listing: { base_price_per_hour: 25 },
      }),
      '2026-07-17T13:00:00.000Z'
    );
    expect(s.overtimeAmount).toBe(25);
  });
});

describe('resolveListingSecurityDeposit', () => {
  it('defaults to 8x the hourly rate when omitted', () => {
    expect(svc.resolveListingSecurityDeposit(undefined, 40)).toBe(320);
  });

  it('keeps an explicit override, including zero', () => {
    expect(svc.resolveListingSecurityDeposit(100, 40)).toBe(100);
    expect(svc.resolveListingSecurityDeposit(0, 40)).toBe(0);
  });

  it('rejects negative or non-numeric deposits', () => {
    expect(() => svc.resolveListingSecurityDeposit(-1, 40)).toThrow(
      HttpException
    );
    expect(() => svc.resolveListingSecurityDeposit(NaN as any, 40)).toThrow(
      HttpException
    );
  });
});

describe('assertStripeRentalEndWithinAuthWindow', () => {
  it('accepts bookings that end within 6 days', () => {
    const endAt = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    expect(() => svc.assertStripeRentalEndWithinAuthWindow(endAt)).not.toThrow();
  });

  it('rejects bookings that end beyond the 6-day auth window', () => {
    const endAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    expect(() => svc.assertStripeRentalEndWithinAuthWindow(endAt)).toThrow(
      HttpException
    );
  });
});

describe('Stripe rental payment state safety', () => {
  it('does not settle the ledger before Stripe confirms capture', async () => {
    const service: any = Object.create(RentalsService.prototype);
    service.stripeCaptureService = {
      captureRentalBookingPaymentIntent: jest.fn().mockResolvedValue({
        success: true,
        captured: false,
      }),
    };
    service.creditClientWalletForStripeCapture = jest.fn();
    service.registerRentalProceedsLedger = jest.fn();
    service.patchBooking = jest.fn();

    await expect(
      service.settleStripeAuthorizedBooking(
        makeBooking({
          booking_number: 'RNT-1',
          authorized_amount: 480,
        }),
        {
          contract: 160,
          deposit: 320,
          overtimeAmount: 0,
          stripeCharge: 160,
        }
      )
    ).rejects.toThrow('Stripe capture is still processing');
    expect(service.creditClientWalletForStripeCapture).not.toHaveBeenCalled();
    expect(service.patchBooking).not.toHaveBeenCalled();
  });

  it('releases an authorization that lands after booking cancellation', async () => {
    const service: any = Object.create(RentalsService.prototype);
    const booking = {
      id: 'b1',
      booking_number: 'RNT-1',
      status: 'cancelled',
    };
    service.fetchBookingByBookingNumber = jest.fn().mockResolvedValue(booking);
    service.cancelStripeAuthorizationIfAny = jest.fn().mockResolvedValue(undefined);

    await service.processRentalBookingAuthorization({
      entity_id: 'RNT-1',
      amount: 480,
    });

    expect(service.cancelStripeAuthorizationIfAny).toHaveBeenCalledWith(booking);
  });
});
