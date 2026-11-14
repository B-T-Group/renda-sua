import {
  compareSoonestRequestStart,
  dashboardPeriodLabel,
  formatYouReceive,
  respondWithinAmber,
  respondWithinHours,
  respondWindow,
} from './dashboardRentalRequests';

describe('dashboard rental request display', () => {
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
