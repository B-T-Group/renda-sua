import { formatCatalogMoney } from './rentalRequestDisplay';

describe('formatCatalogMoney', () => {
  it('formats XAF and CAD for the rental catalog', () => {
    expect(formatCatalogMoney(45000, 'XAF', 'en')).toBe('45\u00A0000\u00A0FCFA');
    expect(formatCatalogMoney(85, 'CAD', 'en-CA')).toBe('$85.00');
    expect(formatCatalogMoney(45, 'CAD', 'fr')).toBe('45,00\u00A0$');
  });
});