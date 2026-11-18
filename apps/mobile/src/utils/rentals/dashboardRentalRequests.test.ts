import {
  compareSoonestRequestStart,
  contractHoursOffer,
  dashboardPeriodLabel,
  respondWithinAmber,
  respondWithinHours,
} from './dashboardRentalRequests';

describe('dashboard rental requests', () => {
  it('caps the contract at 48 hours and hides it under one hour', () => {
    const now = new Date('2026-11-18T15:00:00.000Z');
    const soon = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
    expect(contractHoursOffer(soon, now).hidden).toBe(true);
    expect(contractHoursOffer(new Date(now.getTime() + 10.4 * 3600000).toISOString(), now).maxHours).toBe(10);
  });

  it('counts hours and marks under four hours amber', () => {
    const now = Date.parse('2026-11-14T14:41:00.000Z');
    expect(respondWithinHours('2026-11-14T16:41:00.000Z', now)).toBe(2);
    expect(respondWithinAmber('2026-11-14T16:41:00.000Z', now)).toBe(true);
    expect(respondWithinAmber('2026-11-15T12:41:00.000Z', now)).toBe(false);
  });

  it('shows an exclusive end for a multi-day stay', () => {
    const label = dashboardPeriodLabel(
      [
        { billing: 'all_day', calendar_date: '2026-11-17', start_at: 'a', end_at: 'b' },
        { billing: 'all_day', calendar_date: '2026-11-18', start_at: 'a', end_at: 'b' },
      ],
      'en',
      'All day',
      (count) => `${count} days`
    );
    expect(label).toBe('17 Nov – 19 Nov · 2 days');
  });

  it('sorts the soonest start first', () => {
    const later = { created_at: '2026-11-14T01:00:00.000Z', requested_start_at: '2026-11-21T00:00:00.000Z' };
    const sooner = { created_at: '2026-11-14T09:00:00.000Z', requested_start_at: '2026-11-14T16:00:00.000Z' };
    expect([later, sooner].sort(compareSoonestRequestStart)[0]).toBe(sooner);
  });
});
