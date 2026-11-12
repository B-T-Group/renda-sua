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
});
