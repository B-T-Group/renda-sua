import { computeRentalPricingLines } from './rentalPricingLines';

describe('computeRentalPricingLines', () => {
  it('H2 prices two units at 15000, not 7500', () => {
    const start = new Date('2026-11-18T12:00:00.000Z');
    const priced = computeRentalPricingLines(
      [{ start, end: new Date(start.getTime() + 3 * 60 * 60 * 1000), billing: 'hourly' }],
      2500,
      0,
      2
    );
    expect(priced.total).toBe(15000);
    expect(priced.lines[0]).toMatchObject({ subtotal: 15000, billableHours: 3 });
  });
});
