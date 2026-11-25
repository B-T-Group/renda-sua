import { businessChangedThePrice, formatAssistantMoney, formatRequestAmount } from './rentalRequestDisplay';

const NBSP = '\u00A0';

function joined(text: string): string {
  return text.replace(/ /g, NBSP);
}

describe('formatAssistantMoney', () => {
  it('formats CAD with cents and a Canadian currency sign', () => {
    expect(formatAssistantMoney(25, 'CAD', 'en')).toBe('$25.00');
    expect(formatAssistantMoney(25, 'CAD', 'fr')).toBe('25,00\u00A0$');
    expect(formatAssistantMoney(2500, 'XAF', 'fr')).toBe('2\u00A0500\u00A0FCFA');
  });
});

describe('businessChangedThePrice', () => {
  it('H1 stays quiet on a pending request', () => {
    expect(businessChangedThePrice('pending', 2500, 3000)).toBe(false);
    expect(businessChangedThePrice('available', 2500, 3000)).toBe(true);
  });
});

describe('formatRequestAmount', () => {
  it('groups XAF and XOF with a non-breaking space and an FCFA suffix', () => {
    expect(formatRequestAmount(45000, 'XAF', 'en')).toBe(joined('45 000 FCFA'));
    expect(formatRequestAmount(45000, 'XAF', 'fr')).toBe(joined('45 000 FCFA'));
    expect(formatRequestAmount(55000, 'XOF', 'fr')).toBe(joined('55 000 FCFA'));
    expect(formatRequestAmount(10000, 'FCFA', 'en')).toBe(joined('10 000 FCFA'));
  });

  it('keeps digit groups and FCFA on one line', () => {
    const value = formatRequestAmount(45000, 'XAF', 'fr');
    expect(value).toBe(`45${NBSP}000${NBSP}FCFA`);
    expect(value.includes(' ')).toBe(false);
  });

  it('leaves USD on the currency formatter', () => {
    expect(formatRequestAmount(260, 'USD', 'en')).not.toMatch(/FCFA/);
    expect(formatRequestAmount(260, 'USD', 'fr')).not.toMatch(/FCFA/);
  });

  it('formats CAD like the shared confirmation amounts', () => {
    expect(formatRequestAmount(65, 'CAD', 'en')).toBe('$65.00');
    expect(formatRequestAmount(65, 'CAD', 'fr')).toBe('65,00\u00a0$');
    expect(formatRequestAmount(45, 'CAD', 'en')).not.toContain('CA$');
    expect(formatRequestAmount(45, 'CAD', 'fr')).not.toMatch(/\bCAD\b/);
  });

  it('rounds to the nearest franc, keeps the sign, and groups millions', () => {
    expect(formatRequestAmount(45000.4, 'XAF', 'en')).toBe(joined('45 000 FCFA'));
    expect(formatRequestAmount(45000.5, 'xaf', 'fr')).toBe(joined('45 001 FCFA'));
    expect(formatRequestAmount(0, 'XOF', 'en')).toBe(joined('0 FCFA'));
    expect(formatRequestAmount(-2500, 'XAF', 'fr')).toBe(joined('-2 500 FCFA'));
    expect(formatRequestAmount(1000000, 'FCFA', 'en')).toBe(joined('1 000 000 FCFA'));
  });
});
