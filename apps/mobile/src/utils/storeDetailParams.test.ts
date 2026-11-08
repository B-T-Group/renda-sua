import { describe, expect, it } from 'vitest';
import { storeDetailParams } from './storeDetailParams';

describe('storeDetailParams', () => {
  it('opens a food item on the food menu and a grocery item on the full store', () => {
    expect(storeDetailParams('loc-1', true)).toEqual({
      businessId: 'loc-1',
      foodOnly: true,
    });
    expect(storeDetailParams('loc-1', false)).toEqual({ businessId: 'loc-1' });
    expect(storeDetailParams('loc-1', false)).not.toHaveProperty('foodOnly');
  });
});
