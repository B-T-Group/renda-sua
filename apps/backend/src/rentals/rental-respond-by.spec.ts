import { compareSoonestRentalStart, computeRespondBy } from './rental-respond-by';
import { EXPIRE_RENTAL_REQUEST_NO_RESPONSE } from './rentals-queries';

const created = '2026-11-14T14:21:00.000Z';

describe('computeRespondBy', () => {
  it('uses the start time when it is sooner than 24 hours', () => {
    const start = '2026-11-14T16:41:00.000Z';
    const decision = computeRespondBy({ createdAt: created, startAt: start });
    expect(decision.window).toBe('start');
    expect(decision.respondBy).toBe(new Date(start).toISOString());
  });

  it('uses 24 hours when the rental starts later', () => {
    const start = '2026-11-17T05:00:00.000Z';
    const decision = computeRespondBy({ createdAt: created, startAt: start });
    expect(decision.window).toBe('sla');
    expect(Date.parse(decision.respondBy) - Date.parse(created)).toBe(24 * 60 * 60 * 1000);
  });

  it('treats an equal start and 24h mark as the 24h window', () => {
    const start = new Date(Date.parse(created) + 24 * 60 * 60 * 1000).toISOString();
    expect(computeRespondBy({ createdAt: created, startAt: start }).window).toBe('sla');
  });
});

describe('compareSoonestRentalStart', () => {
  it('orders by soonest start, then created_at', () => {
    const godox = { created_at: '2026-11-14T14:00:00.000Z', requested_start_at: '2026-11-14T16:00:00.000Z' };
    const canon = { created_at: '2026-11-14T12:00:00.000Z', requested_start_at: '2026-11-17T05:00:00.000Z' };
    const dji = { created_at: '2026-11-14T09:00:00.000Z', requested_start_at: '2026-11-21T05:00:00.000Z' };
    const sorted = [dji, canon, godox].sort(compareSoonestRentalStart);
    expect(sorted.map((row) => row.requested_start_at)).toEqual([
      godox.requested_start_at,
      canon.requested_start_at,
      dji.requested_start_at,
    ]);
  });
});

describe('no_response compare-and-set', () => {
  it('declines only a pending row and stores no_response', () => {
    expect(EXPIRE_RENTAL_REQUEST_NO_RESPONSE).toContain('status: { _eq: pending }');
    expect(EXPIRE_RENTAL_REQUEST_NO_RESPONSE).toContain('unavailable_reason_code: "no_response"');
    expect(EXPIRE_RENTAL_REQUEST_NO_RESPONSE).not.toContain('item_unavailable');
  });
});
