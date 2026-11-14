import { estimatedPeriodLabel, formatRentalAmount, perDayPriceLabel } from './assistant-rental-format';

describe('rental amount labels', () => {
  it('groups XAF as FCFA with non-breaking spaces', () => {
    expect(formatRentalAmount(45000, 'XAF')).toBe('45\u00A0000\u00A0FCFA');
    expect(perDayPriceLabel(45000, 'XAF', 'fr')).toBe('45\u00A0000\u00A0FCFA/jour');
    expect(perDayPriceLabel(2500, 'XAF', 'en')).toBe('2\u00A0500\u00A0FCFA/day');
  });

  it('formats CAD like the other Stripe screens', () => {
    expect(formatRentalAmount(25, 'CAD', 'en')).toBe('$25.00');
    expect(formatRentalAmount(25, 'CAD', 'fr')).toBe('25,00\u00A0$');
    expect(perDayPriceLabel(25, 'CAD', 'en')).toBe('$25.00/day');
    expect(perDayPriceLabel(25, 'CAD', 'fr')).toBe('25,00\u00A0$/jour');
  });

  it('keeps other currencies and labels the period as an estimate', () => {
    expect(estimatedPeriodLabel(2500, 'XAF', 1, 'en')).toBe('Est. 2\u00A0500\u00A0FCFA · 1 day');
    expect(estimatedPeriodLabel(2500, 'XOF', 1, 'fr')).toBe('Env. 2\u00A0500\u00A0FCFA · 1 jour');
  });
});
