import { resolveProductCardHint } from './resolveProductCardHint';

describe('resolveProductCardHint', () => {
  it('prefers a closed kitchen over a deal', () => {
    expect(resolveProductCardHint({ isFood: true, foodOpen: false, hasDeal: true })).toEqual({
      id: 'food_closed',
    });
  });

  it('says how many are left when stock is 1 to 5', () => {
    expect(resolveProductCardHint({ quantity: 3 })).toEqual({ id: 'low_stock', count: 3 });
  });

  it('asks to check availability when nothing is listed', () => {
    expect(resolveProductCardHint({ quantity: 0 })).toEqual({ id: 'check_availability' });
  });

  it('falls through to the deal, then the fulfillment hint', () => {
    expect(resolveProductCardHint({ quantity: 12, hasDeal: true })).toEqual({ id: 'deal' });
    expect(resolveProductCardHint({ fulfillmentHint: 'Pickup today' })).toEqual({
      id: 'fulfillment',
      label: 'Pickup today',
    });
  });
});
