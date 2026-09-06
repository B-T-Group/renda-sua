import { describe, expect, it } from 'vitest';
import { itemIdentitySpecs } from './itemIdentitySpecs';
import type { BusinessCatalogItem } from '@/types/business/items';

function baseItem(overrides: Partial<BusinessCatalogItem> = {}): BusinessCatalogItem {
  return {
    id: 'item-1',
    name: 'Test',
    ...overrides,
  };
}

describe('itemIdentitySpecs', () => {
  it('returns empty when weight and dimensions are unset', () => {
    expect(itemIdentitySpecs(baseItem())).toEqual({});
  });

  it('formats weight with unit', () => {
    expect(
      itemIdentitySpecs(baseItem({ weight: 1.5, weight_unit: 'kg' }))
    ).toEqual({ weightLabel: '1.5 kg' });
  });

  it('includes dimensions when set', () => {
    expect(
      itemIdentitySpecs(baseItem({ dimensions: '10 x 20 cm' }))
    ).toEqual({ dimensionsLabel: '10 x 20 cm' });
  });

  it('ignores zero or invalid weight', () => {
    expect(itemIdentitySpecs(baseItem({ weight: 0, weight_unit: 'kg' }))).toEqual({});
  });
});
