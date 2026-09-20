import {
  creditExpiresAt,
  personaMatches,
  referrerAtCap,
  subjectStoreAmount,
} from './credit-campaign.policy';

describe('credit campaign policy', () => {
  const row = { subject_amount: 500, subject_bonus_if_referred: 250 };

  it('adds the referred bonus only when a code was used', () => {
    expect(subjectStoreAmount(row, false)).toBe(500);
    expect(subjectStoreAmount(row, true)).toBe(750);
  });

  it('stops referrer cash at the cap but leaves the subject bonus separate', () => {
    expect(referrerAtCap(4, 5)).toBe(false);
    expect(referrerAtCap(5, 5)).toBe(true);
    expect(subjectStoreAmount(row, true)).toBe(750);
  });

  it('matches the watched persona', () => {
    expect(personaMatches('any', ['agent'])).toBe(true);
    expect(personaMatches('client', ['client'])).toBe(true);
    expect(personaMatches('client', ['agent'])).toBe(false);
  });

  it('sets store-credit expiry from the campaign days', () => {
    const expiry = creditExpiresAt(2, new Date('2026-01-01T00:00:00.000Z'));
    expect(expiry).toBe('2026-01-03T00:00:00.000Z');
    expect(creditExpiresAt(null)).toBeNull();
  });
});
