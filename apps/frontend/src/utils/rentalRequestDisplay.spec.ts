import { formatRequestAmount } from './rentalRequestDisplay';

describe('formatRequestAmount', () => {
  it('groups XAF and XOF with a space and an FCFA suffix in both languages', () => {
    expect(formatRequestAmount(45000, 'XAF', 'en')).toBe('45 000 FCFA');
    expect(formatRequestAmount(45000, 'XAF', 'fr')).toBe('45 000 FCFA');
    expect(formatRequestAmount(55000, 'XOF', 'fr')).toBe('55 000 FCFA');
    expect(formatRequestAmount(10000, 'FCFA', 'en')).toBe('10 000 FCFA');
  });

  it('leaves USD on the currency formatter', () => {
    expect(formatRequestAmount(260, 'USD', 'en')).not.toMatch(/FCFA/);
    expect(formatRequestAmount(260, 'USD', 'fr')).not.toMatch(/FCFA/);
  });

  it('rounds to the nearest franc, keeps the sign, and groups millions', () => {
    expect(formatRequestAmount(45000.4, 'XAF', 'en')).toBe('45 000 FCFA');
    expect(formatRequestAmount(45000.5, 'xaf', 'fr')).toBe('45 001 FCFA');
    expect(formatRequestAmount(0, 'XOF', 'en')).toBe('0 FCFA');
    expect(formatRequestAmount(-2500, 'XAF', 'fr')).toBe('-2 500 FCFA');
    expect(formatRequestAmount(1000000, 'FCFA', 'en')).toBe('1 000 000 FCFA');
  });
});
