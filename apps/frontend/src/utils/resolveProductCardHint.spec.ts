import { resolveProductCardHint } from './resolveProductCardHint';

describe('resolveProductCardHint', () => {
  it('keeps a closed or open kitchen ahead of stock and deals', () => {
    expect(
      resolveProductCardHint({ isFood: true, foodOpen: false, quantity: 1, hasDeal: true })
    ).toEqual({ id: 'food_closed' });
    expect(
      resolveProductCardHint({ isFood: true, foodOpen: true, quantity: 2, hasDeal: true })
    ).toEqual({ id: 'food_open' });
  });

  it('asks the shopper to check availability at zero, including when a deal is on', () => {
    expect(resolveProductCardHint({ quantity: 0, hasDeal: true })).toEqual({
      id: 'check_availability',
    });
  });

  it('counts 1 to 5 as low stock and lets a deal show from 6', () => {
    expect(resolveProductCardHint({ quantity: 5 })).toEqual({ id: 'low_stock', count: 5 });
    expect(resolveProductCardHint({ quantity: 6, hasDeal: true })).toEqual({ id: 'deal' });
    expect(resolveProductCardHint({ quantity: null, fulfillmentHint: '' })).toBeNull();
  });
});
