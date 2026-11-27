import { CANCEL_RENTAL_REQUEST, EXPIRE_RENTAL_REQUEST_NO_RESPONSE, LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY } from './rentals-queries';
import {
  cappedContractExpiry,
  compareSoonestRentalStart,
  computeRespondBy,
  contractHoursOffer,
  effectiveRespondBy,
} from './rental-respond-by';

const created = '2026-11-14T14:21:00.000Z';

describe('computeRespondBy', () => {
  it('uses the start time when it is sooner than 24 hours', () => {
    const start = '2026-11-14T16:41:00.000Z';
    const decision = computeRespondBy({ createdAt: created, startAt: start, timeZone: 'UTC' });
    expect(decision.window).toBe('start');
    expect(decision.respondBy).toBe(new Date(start).toISOString());
  });

  it('uses 24 hours when the rental starts later', () => {
    const start = '2026-11-17T05:00:00.000Z';
    const decision = computeRespondBy({ createdAt: created, startAt: start, timeZone: 'UTC' });
    expect(decision.window).toBe('sla');
    expect(Date.parse(decision.respondBy) - Date.parse(created)).toBe(24 * 60 * 60 * 1000);
  });

  it('treats an equal start and 24h mark as the 24h window', () => {
    const start = new Date(Date.parse(created) + 24 * 60 * 60 * 1000).toISOString();
    expect(computeRespondBy({ createdAt: created, startAt: start, timeZone: 'UTC' }).window).toBe('sla');
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
    expect(contractHoursOffer(inTen, now, 'UTC')).toEqual({ hidden: false, hours: 10, maxHours: 10 });
    expect(contractHoursOffer(inThreeDays, now, 'UTC')).toEqual({ hidden: false, hours: 48, maxHours: 48 });
  });

  it('hides the field under one hour and ends the contract at the start', () => {
    const soon = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
    expect(contractHoursOffer(soon, now, 'UTC').hidden).toBe(true);
    expect(cappedContractExpiry(soon, 48, now, 'UTC')).toBe(new Date(soon).toISOString());
    expect(cappedContractExpiry(inPast(now), 1, now, 'UTC')).toBe(new Date(inPast(now)).toISOString());
  });

  it('rejects a length that would run past the start or past 48 hours', () => {
    const inTen = new Date(now.getTime() + 10.5 * 60 * 60 * 1000).toISOString();
    expect(cappedContractExpiry(inTen, 11, now, 'UTC')).toBeNull();
    expect(cappedContractExpiry(inTen, 10, now, 'UTC')).toBe(new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString());
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
    expect(LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY).toContain('where: $where');
    expect(LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY).toContain('order_by: { respond_by: asc }');
    expect(LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY).toContain('limit: $limit');
    expect(LIST_PENDING_RENTAL_REQUESTS_FOR_EXPIRY).toContain('respond_by');
  });
});

/**
 * Request starts are the listing's wall clock stored as UTC components; respond_by
 * and contract expiry are real instants, so the "by the start" cap uses the real start.
 */
describe('respond-by and contract expiry on the listing clock', () => {
  it('lets a Toronto business accept a same-day 14:00 request at 11:10 AM (Samuel, 26 Nov)', () => {
    const decision = computeRespondBy({
      createdAt: '2026-11-26T16:08:35.768Z',
      startAt: '2026-11-26T14:00:00.000Z',
      timeZone: 'America/Toronto',
    });
    expect(decision).toEqual({ respondBy: '2026-11-26T19:00:00.000Z', window: 'start' });
    expect(Date.parse('2026-11-26T16:10:00.000Z') <= Date.parse(decision.respondBy)).toBe(true);
  });

  it('caps Douala and Manila at the real start, not hours late', () => {
    expect(
      computeRespondBy({ createdAt: '2026-11-26T06:00:00.000Z', startAt: '2026-11-26T14:00:00.000Z', timeZone: 'Africa/Douala' })
        .respondBy
    ).toBe('2026-11-26T13:00:00.000Z');
    expect(
      computeRespondBy({ createdAt: '2026-11-26T00:00:00.000Z', startAt: '2026-11-26T14:00:00.000Z', timeZone: 'Asia/Manila' })
        .respondBy
    ).toBe('2026-11-26T06:00:00.000Z');
  });

  it('keeps the 24-hour window when the real start is later', () => {
    const decision = computeRespondBy({
      createdAt: '2026-11-26T16:00:00.000Z',
      startAt: '2026-11-27T12:00:00.000Z',
      timeZone: 'America/Toronto',
    });
    expect(decision).toEqual({ respondBy: '2026-11-27T16:00:00.000Z', window: 'sla' });
  });

  it('handles the Toronto DST change days', () => {
    expect(
      computeRespondBy({ createdAt: '2026-03-08T04:00:00.000Z', startAt: '2026-03-08T10:00:00.000Z', timeZone: 'America/Toronto' })
        .respondBy
    ).toBe('2026-03-08T14:00:00.000Z');
    expect(
      computeRespondBy({ createdAt: '2026-11-01T04:00:00.000Z', startAt: '2026-11-01T10:00:00.000Z', timeZone: 'America/Toronto' })
        .respondBy
    ).toBe('2026-11-01T15:00:00.000Z');
  });

  it('labels a stored respond_by at the real start as the start window', () => {
    const decision = effectiveRespondBy({
      createdAt: '2026-11-26T16:08:35.768Z',
      respondBy: '2026-11-26T19:00:00.000Z',
      startAt: '2026-11-26T14:00:00.000Z',
      timeZone: 'America/Toronto',
    });
    expect(decision.window).toBe('start');
  });

  it('measures contract hours to the real start and ends a short contract there', () => {
    const now = new Date('2026-11-26T16:10:00.000Z');
    const torontoStart = '2026-11-26T14:00:00.000Z';
    expect(contractHoursOffer(torontoStart, now, 'America/Toronto')).toEqual({ hidden: false, hours: 2, maxHours: 2 });
    expect(cappedContractExpiry(torontoStart, 2, now, 'America/Toronto')).toBe('2026-11-26T18:10:00.000Z');
    expect(cappedContractExpiry(torontoStart, 3, now, 'America/Toronto')).toBeNull();
    const soon = '2026-11-26T11:30:00.000Z';
    expect(contractHoursOffer(soon, now, 'America/Toronto').hidden).toBe(true);
    expect(cappedContractExpiry(soon, 48, now, 'America/Toronto')).toBe('2026-11-26T16:30:00.000Z');
    const doualaStart = '2026-11-26T18:00:00.000Z';
    expect(contractHoursOffer(doualaStart, now, 'Africa/Douala')).toEqual({ hidden: true, hours: 0.8333333333333334, maxHours: 0 });
    expect(cappedContractExpiry(doualaStart, 1, now, 'Africa/Douala')).toBe('2026-11-26T17:00:00.000Z');
  });
});
