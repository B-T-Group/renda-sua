import {
  defaultReturnAt,
  isEarlyReturn,
  returnDueInstantMs,
  settleEarlyAsContract,
} from './early-return.policy';

const toronto = (end_at: string, extra: Record<string, unknown> = {}) => ({
  end_at,
  rental_location_listing: { business_location: { address: { country: 'CA' } } },
  ...extra,
});
const douala = (end_at: string) => ({
  end_at,
  rental_location_listing: { business_location: { address: { country: 'CM' } } },
});

describe('early return policy', () => {
  it('reads the due on the listing clock', () => {
    expect(new Date(returnDueInstantMs(toronto('2026-11-26T18:00:00.000Z'))).toISOString()).toBe(
      '2026-11-26T23:00:00.000Z'
    );
    expect(new Date(returnDueInstantMs(douala('2026-11-26T18:00:00.000Z'))).toISOString()).toBe(
      '2026-11-26T17:00:00.000Z'
    );
  });

  it('Toronto: 3:40 PM (20:40Z) before a 6:00 PM end is early; 6:10 PM is not', () => {
    const b = toronto('2026-11-26T18:00:00.000Z');
    expect(isEarlyReturn('2026-11-26T20:40:00.000Z', b)).toBe(true);
    expect(isEarlyReturn('2026-11-26T23:10:00.000Z', b)).toBe(false);
  });

  it('Douala: 5:30 PM (16:30Z) is early; 6:30 PM (17:30Z) is late', () => {
    const b = douala('2026-11-26T18:00:00.000Z');
    expect(isEarlyReturn('2026-11-26T16:30:00.000Z', b)).toBe(true);
    expect(isEarlyReturn('2026-11-26T17:30:00.000Z', b)).toBe(false);
  });

  it('uses return_due_at (hourly early start) when present', () => {
    const b = toronto('2026-11-26T18:00:00.000Z', { return_due_at: '2026-11-26T15:00:00.000Z' });
    // Due 3:00 PM Toronto = 20:00Z: a 3:40 PM return is not early.
    expect(isEarlyReturn('2026-11-26T20:40:00.000Z', b)).toBe(false);
  });

  it('is never early without a time or a due', () => {
    expect(isEarlyReturn(null, toronto('2026-11-26T18:00:00.000Z'))).toBe(false);
    expect(isEarlyReturn('2026-11-26T20:40:00.000Z', { end_at: null })).toBe(false);
  });

  it('settles an early return as exactly the contract', () => {
    const late = { contract: 60, deposit: 180, overtimeHours: 3, overtimeAmount: 45, stripeCharge: 105 };
    expect(settleEarlyAsContract(late, true)).toEqual({
      contract: 60,
      deposit: 180,
      overtimeHours: 0,
      overtimeAmount: 0,
      stripeCharge: 60,
    });
    expect(settleEarlyAsContract(late, false)).toBe(late);
  });

  it('defaults the return time to the business input, then the renter report, then now', () => {
    const now = new Date('2026-11-26T21:00:00.000Z');
    expect(defaultReturnAt('2026-11-26T20:30:00.000Z', '2026-11-26T20:40:00.000Z', now).toISOString()).toBe(
      '2026-11-26T20:30:00.000Z'
    );
    expect(defaultReturnAt(undefined, '2026-11-26T20:40:00.000Z', now).toISOString()).toBe(
      '2026-11-26T20:40:00.000Z'
    );
    expect(defaultReturnAt('  ', null, now)).toBe(now);
  });
});
