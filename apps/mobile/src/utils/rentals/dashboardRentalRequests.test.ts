import {
  compareSoonestRequestStart,
  contractHoursOffer,
  dashboardPeriodLabel,
  respondWithinAmber,
  respondWithinHours,
  totalOverrideTooHigh,
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

  it('N12 allows a discount of a quote above any old absolute cap', () => {
    expect(totalOverrideTooHigh(2_000_000, 1_800_000, 1_000_000)).toBe(false);
    expect(totalOverrideTooHigh(2_000_000, 2_500_000, 1_000_000)).toBe(true);
    expect(totalOverrideTooHigh(2_000_000, 20_000_001)).toBe(true);
    expect(totalOverrideTooHigh(0, 1_000_000)).toBe(false);
    expect(totalOverrideTooHigh(0, 40_000, 50_000)).toBe(false);
    expect(totalOverrideTooHigh(0, 60_000, 50_000)).toBe(true);
  });

  it('shows booked days and the return morning for a multi-day stay', () => {
    const label = dashboardPeriodLabel(
      [
        { billing: 'all_day', calendar_date: '2026-11-17', start_at: 'a', end_at: 'b' },
        { billing: 'all_day', calendar_date: '2026-11-18', start_at: 'a', end_at: 'b' },
      ],
      'en',
      'All day',
      (count) => `${count} days`
    );
    expect(label).toBe('17 Nov – 18 Nov · 2 days · Return 19\u00A0Nov');
  });

  it('sorts the soonest start first', () => {
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
