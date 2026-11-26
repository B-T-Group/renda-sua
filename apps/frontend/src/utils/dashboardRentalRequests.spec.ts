import {
  compareSoonestRequestStart,
  contractHoursOffer,
  dashboardPeriodLabel,
  formatYouReceive,
  respondWithinAmber,
  respondWithinHours,
  respondWindow,
  totalOverrideTooHigh,
  expiredRequestWindow,
  isExpiredRentalRequest,
} from './dashboardRentalRequests';

describe('dashboard rental request display', () => {
  it('caps the contract at 48 hours and hides it under one hour', () => {
    const now = new Date('2026-11-18T15:00:00.000Z');
    const soon = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
    const later = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
    expect(contractHoursOffer(soon, now).hidden).toBe(true);
    expect(contractHoursOffer(later, now)).toEqual({ hidden: false, hours: 48, maxHours: 48 });
  });

  it('counts whole hours and turns amber under 4 hours', () => {
    const now = Date.parse('2026-11-14T14:41:00.000Z');
    expect(respondWithinHours('2026-11-14T16:41:00.000Z', now)).toBe(2);
    expect(respondWithinAmber('2026-11-14T16:41:00.000Z', now)).toBe(true);
    expect(respondWithinHours('2026-11-15T12:41:00.000Z', now)).toBe(22);
    expect(respondWithinAmber('2026-11-15T12:41:00.000Z', now)).toBe(false);
  });

  it('picks the start window only when start is sooner than 24 hours', () => {
    expect(respondWindow('2026-11-14T14:21:00.000Z', '2026-11-14T16:41:00.000Z')).toBe('start');
    expect(respondWindow('2026-11-14T12:41:00.000Z', '2026-11-17T05:00:00.000Z')).toBe('sla');
  });

  it('N12 allows a discount of a quote above any old absolute cap', () => {
    expect(totalOverrideTooHigh(2_000_000, 1_800_000, 1_000_000)).toBe(false);
    expect(totalOverrideTooHigh(2_000_000, 2_500_000, 1_000_000)).toBe(true);
    expect(totalOverrideTooHigh(2_000_000, 20_000_001)).toBe(true);
    expect(totalOverrideTooHigh(0, 1_000_000)).toBe(false);
    expect(totalOverrideTooHigh(0, 40_000, 50_000)).toBe(false);
    expect(totalOverrideTooHigh(0, 60_000, 50_000)).toBe(true);
  });

  it('formats an all-day stay and a multi-day stay like the dashboard', () => {
    const allDay = dashboardPeriodLabel(
      [{ billing: 'all_day', calendar_date: '2026-11-14', start_at: '2026-11-14T04:00:00.000Z', end_at: '2026-11-15T04:00:00.000Z' }],
      'en',
      'All day',
      (count) => `${count} days`
    );
    expect(allDay).toBe('14 Nov · All day');
    const stay = dashboardPeriodLabel(
      [
        { billing: 'all_day', calendar_date: '2026-11-17', start_at: 'a', end_at: 'b' },
        { billing: 'all_day', calendar_date: '2026-11-18', start_at: 'a', end_at: 'b' },
      ],
      'en',
      'All day',
      (count) => `${count} days`
    );
    expect(stay).toBe('17 Nov – 19 Nov · 2 days');
  });

  it('formats CAD for English and French', () => {
    expect(formatYouReceive(45, 'CAD', 'en')).toBe('$45.00');
    expect(formatYouReceive(45, 'CAD', 'fr')).toContain('45,00');
  });

  it('sorts by soonest start', () => {
    const later = { created_at: '2026-11-14T01:00:00.000Z', requested_start_at: '2026-11-21T00:00:00.000Z' };
    const sooner = { created_at: '2026-11-14T09:00:00.000Z', requested_start_at: '2026-11-14T16:00:00.000Z' };
    expect([later, sooner].sort(compareSoonestRequestStart)[0]).toBe(sooner);
  });
});

describe('contractHoursOffer on the listing clock', () => {
  // Samuel's case: 14:00 Toronto start stored as 14:00Z; at 11:10 AM Toronto there are ~2h50 left.
  it('offers whole hours until a Toronto start, not "expired"', () => {
    const offer = contractHoursOffer('2026-11-26T14:00:00.000Z', new Date('2026-11-26T16:10:00.000Z'), 'America/Toronto');
    expect(offer.hidden).toBe(false);
    expect(offer.maxHours).toBe(2);
  });

  it('hides the hours picker in the last hour before a Douala start', () => {
    const offer = contractHoursOffer('2026-11-26T14:00:00.000Z', new Date('2026-11-26T12:30:00.000Z'), 'Africa/Douala');
    expect(offer.hidden).toBe(true);
  });
});

describe('expired rental request', () => {
  it('is only the auto-declined no_response row', () => {
    expect(isExpiredRentalRequest({ status: 'unavailable', unavailable_reason_code: 'no_response' })).toBe(true);
    expect(isExpiredRentalRequest({ status: 'unavailable', unavailable_reason_code: 'item_unavailable' })).toBe(false);
    expect(isExpiredRentalRequest({ status: 'pending' })).toBe(false);
  });

  it('prefers the stored window and otherwise compares start to the 24h SLA', () => {
    expect(expiredRequestWindow({ created_at: '2026-11-26T12:00:00.000Z', respond_window: 'start' })).toBe('start');
    expect(
      expiredRequestWindow({
        created_at: '2026-11-26T12:00:00.000Z',
        requested_start_at: '2026-11-26T20:00:00.000Z',
      })
    ).toBe('start');
    expect(
      expiredRequestWindow({
        created_at: '2026-11-26T12:00:00.000Z',
        requested_start_at: '2026-11-29T12:00:00.000Z',
      })
    ).toBe('sla');
  });
});
