import { marketTimeZone, marketsMissingTimeZone } from './market-timezones';

describe('market time zones', () => {
  it('resolves every active market, including Douala for Cameroon', () => {
    expect(marketTimeZone('cm')).toBe('Africa/Douala');
    expect(marketTimeZone('GA')).toBe('Africa/Libreville');
    expect(marketTimeZone('TG')).toBe('Africa/Lome');
    expect(marketTimeZone('BJ')).toBe('Africa/Porto-Novo');
    expect(marketTimeZone('CI')).toBe('Africa/Abidjan');
    expect(marketTimeZone('CA')).toBe('America/Toronto');
    expect(marketTimeZone('PH')).toBe('Asia/Manila');
  });

  it('fails readiness when a market has no time zone', () => {
    expect(marketsMissingTimeZone(['CM', 'GA', 'TG'])).toEqual([]);
    expect(marketsMissingTimeZone(['CM', 'ZZ'])).toEqual(['ZZ']);
  });
});
