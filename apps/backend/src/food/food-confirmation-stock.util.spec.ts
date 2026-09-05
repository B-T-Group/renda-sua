import { resolveQuantityForRemaining } from './food-confirmation-stock.util';

describe('resolveQuantityForRemaining', () => {
  it('keeps the reserved units for the order on top of what is left', () => {
    const actual = resolveQuantityForRemaining({
      remainingQuantity: 4,
      reservedQuantity: 2,
    });

    expect(actual).toBe(6);
  });

  it('marks the dish out of stock when nothing is left', () => {
    const actual = resolveQuantityForRemaining({
      remainingQuantity: 0,
      reservedQuantity: 3,
    });

    expect(actual).toBe(3);
  });

  it('treats a negative remaining count as zero', () => {
    const actual = resolveQuantityForRemaining({
      remainingQuantity: -5,
      reservedQuantity: 1,
    });

    expect(actual).toBe(1);
  });

  it('truncates fractional input', () => {
    const actual = resolveQuantityForRemaining({
      remainingQuantity: 2.7,
      reservedQuantity: 1.2,
    });

    expect(actual).toBe(3);
  });
});
