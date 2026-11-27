import { formatRentalMoney, formatSearchMoney } from './rentalRequestDisplay';

const NBSP = '\u00A0';

function joined(text: string): string {
  return text.replace(/ /g, NBSP);
}

describe('formatSearchMoney', () => {
  it('puts the amount before FCFA in English and French, with non-breaking spaces', () => {
    expect(formatSearchMoney(800, 'XAF', 'en')).toBe(joined('800 FCFA'));
    expect(formatSearchMoney(1140, 'XAF', 'en')).toBe(joined('1 140 FCFA'));
    expect(formatSearchMoney(27000, 'XAF', 'en')).toBe(joined('27 000 FCFA'));
    expect(formatSearchMoney(800, 'XAF', 'fr')).toBe(joined('800 FCFA'));
    expect(formatSearchMoney(1140, 'FCFA', 'fr')).toBe(joined('1 140 FCFA'));
    expect(formatSearchMoney(27000, 'XAF', 'en').startsWith('FCFA')).toBe(false);
  });

  it('formats CAD as $45.00 in English and 45,00 $ in French', () => {
    expect(formatSearchMoney(45, 'CAD', 'en')).toBe('$45.00');
    expect(formatSearchMoney(45, 'CAD', 'fr')).toBe(`45,00${NBSP}$`);
  });
});

describe('formatRentalMoney', () => {
  it('formats XAF, XOF, and FCFA as amount then FCFA with non-breaking spaces', () => {
    expect(formatRentalMoney(2500, 'XAF')).toBe(joined('2 500 FCFA'));
    expect(formatRentalMoney(15000, 'XAF')).toBe(joined('15 000 FCFA'));
    expect(formatRentalMoney(20000, 'xaf')).toBe(joined('20 000 FCFA'));
    expect(formatRentalMoney(55000, 'XOF')).toBe(joined('55 000 FCFA'));
    expect(formatRentalMoney(10000, 'FCFA')).toBe(joined('10 000 FCFA'));
    expect(formatRentalMoney(2500, 'XAF').startsWith('FCFA')).toBe(false);
  });

  it('leaves CAD and USD on the currency formatter', () => {
    expect(formatRentalMoney(45, 'CAD')).not.toMatch(/FCFA/);
    expect(formatRentalMoney(45, 'USD')).not.toMatch(/FCFA/);
  });
});
