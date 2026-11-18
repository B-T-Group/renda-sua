import { CANCEL_RENTAL_REQUEST, EXPIRE_RENTAL_REQUEST_NO_RESPONSE, LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY } from './rentals-queries';
import { cappedContractExpiry, compareSoonestRentalStart, computeRespondBy, contractHoursOffer } from './rental-respond-by';

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

describe('contract hours', () => {
  const now = new Date('2026-11-18T15:00:00.000Z');

  it('defaults to the lesser of 48 and the whole hours until start', () => {
    const inTen = new Date(now.getTime() + 10.5 * 60 * 60 * 1000).toISOString();
    const inThreeDays = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
    expect(contractHoursOffer(inTen, now)).toEqual({ hidden: false, hours: 10, maxHours: 10 });
    expect(contractHoursOffer(inThreeDays, now)).toEqual({ hidden: false, hours: 48, maxHours: 48 });
  });

  it('hides the field under one hour and ends the contract at the start', () => {
    const soon = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
    expect(contractHoursOffer(soon, now).hidden).toBe(true);
    expect(cappedContractExpiry(soon, 48, now)).toBe(new Date(soon).toISOString());
    expect(cappedContractExpiry(inPast(now), 1, now)).toBe(new Date(inPast(now)).toISOString());
  });

  it('rejects a length that would run past the start or past 48 hours', () => {
    const inTen = new Date(now.getTime() + 10.5 * 60 * 60 * 1000).toISOString();
    expect(cappedContractExpiry(inTen, 11, now)).toBeNull();
    expect(cappedContractExpiry(inTen, 10, now)).toBe(new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString());
  });
});

function inPast(now: Date): string {
  return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
}

describe('cancel compare-and-set', () => {
  it('cancels only while the request is still in the status the renter read', () => {
    expect(CANCEL_RENTAL_REQUEST).toContain('status: { _eq: $status }');
    expect(CANCEL_RENTAL_REQUEST).toContain('affected_rows');
  });
});

describe('no_response compare-and-set', () => {
  it('declines only a pending row and stores no_response', () => {
    expect(EXPIRE_RENTAL_REQUEST_NO_RESPONSE).toContain('status: { _eq: pending }');
    expect(EXPIRE_RENTAL_REQUEST_NO_RESPONSE).toContain('unavailable_reason_code: "no_response"');
    expect(EXPIRE_RENTAL_REQUEST_NO_RESPONSE).not.toContain('item_unavailable');
  });

  it('scans pending rows whose stored respond_by has passed', () => {
    expect(LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY).toContain('status: { _eq: pending }');
    expect(LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY).toContain('respond_by: { _lte: $now, _gte: $since }');
    expect(LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY).toContain('limit: $limit');
  });
});
