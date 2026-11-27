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
    end_at: '2026-07-17T13:00:00.000Z', // 13:00 on the Douala clock (no country) = 12:00Z
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

/**
 * end_at is the listing wall clock written with a Z; the return is a real instant.
 * Overtime must compare them on the listing clock.
 */
describe('computeRentalSettlement on the listing wall clock', () => {
  const settle = (country: string, endAt: string, actual: string) =>
    svc.computeRentalSettlement(
      makeBooking({
        end_at: endAt,
        rental_location_listing: { business_location: { address: { country } } },
      }),
      actual
    );

  describe('Toronto (UTC-5): 2-6 PM booking, end_at 18:00 wall = 23:00Z', () => {
    const END = '2026-11-26T18:00:00.000Z';

    it('early return at 3:40 PM ET owes no overtime (was billed 3h before the fix)', () => {
      const s = settle('CA', END, '2026-11-26T20:40:00.000Z');
      expect(s.overtimeHours).toBe(0);
      expect(s.overtimeAmount).toBe(0);
      expect(s.stripeCharge).toBe(160);
    });

    it('on-time return at 6:00 PM ET owes no overtime', () => {
      const s = settle('CA', END, '2026-11-26T23:00:00.000Z');
      expect(s.overtimeHours).toBe(0);
      expect(s.overtimeAmount).toBe(0);
      expect(s.stripeCharge).toBe(160);
    });

    it('late return at 7:30 PM ET bills 2h', () => {
      const s = settle('CA', END, '2026-11-27T00:30:00.000Z');
      expect(s.overtimeHours).toBe(2);
      expect(s.overtimeAmount).toBe(80);
      expect(s.stripeCharge).toBe(240);
    });

    it('one minute late bills 1h', () => {
      expect(settle('CA', END, '2026-11-26T23:01:00.000Z').overtimeAmount).toBe(40);
    });

    it('uses EDT (UTC-4) in summer', () => {
      expect(settle('CA', '2026-07-17T18:00:00.000Z', '2026-07-17T22:00:00.000Z').overtimeHours).toBe(0);
      expect(settle('CA', '2026-07-17T18:00:00.000Z', '2026-07-17T22:30:00.000Z').overtimeHours).toBe(1);
    });
  });

  describe('Douala (UTC+1): 2-6 PM booking, end_at 18:00 wall = 17:00Z', () => {
    const END = '2026-11-26T18:00:00.000Z';

    it('early return at 3:40 PM WAT owes no overtime', () => {
      const s = settle('CM', END, '2026-11-26T14:40:00.000Z');
      expect(s.overtimeAmount).toBe(0);
      expect(s.stripeCharge).toBe(160);
    });

    it('on-time return at 6:00 PM WAT owes no overtime', () => {
      expect(settle('CM', END, '2026-11-26T17:00:00.000Z').overtimeAmount).toBe(0);
    });

    it('late return at 6:50 PM WAT bills 1h (unbilled before the fix)', () => {
      const s = settle('CM', END, '2026-11-26T17:50:00.000Z');
      expect(s.overtimeHours).toBe(1);
      expect(s.overtimeAmount).toBe(40);
      expect(s.stripeCharge).toBe(200);
    });

    it('late return at 8:30 PM WAT bills 3h', () => {
      const s = settle('CM', END, '2026-11-26T19:30:00.000Z');
      expect(s.overtimeHours).toBe(3);
      expect(s.overtimeAmount).toBe(120);
      expect(s.stripeCharge).toBe(280);
    });
  });

  it('owes no overtime when end_at is missing', () => {
    expect(settle('CA', '', '2026-11-26T20:40:00.000Z').overtimeAmount).toBe(0);
  });
});

describe('resolveListingSecurityDeposit', () => {
  it('defaults to 8x the hourly rate when omitted', () => {
    expect(svc.resolveListingSecurityDeposit(undefined, 40)).toBe(320);
  });

  it('stores zero instead of 8x when an XAF or XOF deposit is omitted', () => {
    expect(svc.resolveListingSecurityDeposit(undefined, 40, 'XAF')).toBe(0);
    expect(svc.resolveListingSecurityDeposit(undefined, 40, 'xof')).toBe(0);
    expect(svc.resolveListingSecurityDeposit(undefined, 40, 'CAD')).toBe(320);
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

describe('createBusinessRentalListing default deposit (same rule as web edit and mobile)', () => {
  async function createdDeposit(dto: Record<string, unknown>, currency = 'CAD'): Promise<unknown> {
    const s: any = Object.create(RentalsService.prototype);
    s.requireBusinessId = jest.fn().mockResolvedValue('biz-1');
    s.assertRentalItemForBusiness = jest.fn().mockResolvedValue(currency);
    s.assertLocationForBusiness = jest.fn().mockResolvedValue(undefined);
    s.normalizeWeeklyAvailability = jest.fn().mockReturnValue([]);
    s.upsertWeeklyAvailability = jest.fn().mockResolvedValue(undefined);
    s.hasuraUserService = {
      executeMutation: jest.fn().mockResolvedValue({ insert_rental_location_listings_one: { id: 'L1' } }),
    };
    await s.createBusinessRentalListing({
      rental_item_id: 'item-1',
      business_location_id: 'loc-1',
      units_available: 1,
      ...dto,
    });
    return s.hasuraUserService.executeMutation.mock.calls[0][1].object.security_deposit_amount;
  }

  it('is 8x the hourly price when hourly is on', async () => {
    expect(await createdDeposit({ base_price_per_hour: 40, base_price_per_day: 300 })).toBe(320);
  });

  it('is 8x (day price / 12) when hourly is off, ignoring a stale hourly price', async () => {
    expect(
      await createdDeposit({ base_price_per_hour: 40, base_price_per_day: 300, offers_hourly: false, offers_daily: true })
    ).toBe(200);
  });

  it('stays 0 for XAF and keeps a typed deposit', async () => {
    expect(await createdDeposit({ base_price_per_hour: 3000, base_price_per_day: 27000 }, 'XAF')).toBe(0);
    expect(await createdDeposit({ base_price_per_hour: 40, base_price_per_day: 300, security_deposit_amount: 55 })).toBe(55);
  });
});
