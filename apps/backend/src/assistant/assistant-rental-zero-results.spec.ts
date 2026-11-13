import {
  buildZeroResultDraft,
  normalizeRentalQuery,
  retainedZeroResults,
  stripPersonalDetails,
} from './assistant-rental-zero-results';

describe('zero-result rental demand store', () => {
  const now = new Date('2026-11-13T12:00:00.000Z');

  it('strips phones, emails and names and keeps no user id', () => {
    const raw = 'hammer jean@example.com +237 699 123 456 my name is Samuel Mme Ngo';
    expect(stripPersonalDetails(raw)).not.toMatch(/@|699|Samuel|Ngo/);
    const draft = buildZeroResultDraft(
      { query: raw, market: 'cm', dayCount: 1, hasBudget: false, buyMatches: 0, categoryGuess: 'Tools' },
      now
    );
    expect(draft).toMatchObject({
      normalizedQuery: 'hammer',
      market: 'CM',
      dayBucket: '1',
      categoryGuess: 'Tools',
    });
    expect(draft && 'userId' in draft).toBe(false);
    expect(normalizeRentalQuery('  Marteau!!! ')).toBe('marteau');
  });

  it('drops rows once the 30-day expiry has passed', () => {
    const fresh = buildZeroResultDraft(
      { query: 'ladder', market: 'CM', hasBudget: true, buyMatches: 2 },
      now
    )!;
    const stale = {
      ...fresh,
      expiresAt: new Date('2026-10-01T00:00:00.000Z').toISOString(),
    };
    const later = new Date('2026-12-14T12:00:00.000Z');
    expect(retainedZeroResults([fresh, stale], later).map((row) => row.normalizedQuery)).toEqual([]);
    expect(retainedZeroResults([fresh], new Date('2026-12-01T00:00:00.000Z'))).toHaveLength(1);
    expect(Date.parse(fresh.expiresAt) - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
