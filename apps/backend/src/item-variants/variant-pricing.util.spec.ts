import {
  activeCatalogVariants,
  resolveEffectiveUnitPrice,
} from './variant-pricing.util';

describe('variant-pricing.util', () => {
  describe('resolveEffectiveUnitPrice', () => {
    it('uses location override when present', () => {
      const price = resolveEffectiveUnitPrice({
        inventorySellingPrice: 100,
        variant: { id: 'v1', price: 90 },
        overrides: [{ item_variant_id: 'v1', selling_price: 80 }],
      });
      expect(price).toBe(80);
    });

    it('falls back to variant price when no override', () => {
      const price = resolveEffectiveUnitPrice({
        inventorySellingPrice: 100,
        variant: { id: 'v1', price: 90 },
        overrides: [],
      });
      expect(price).toBe(90);
    });

    it('falls back to inventory selling_price', () => {
      const price = resolveEffectiveUnitPrice({
        inventorySellingPrice: 100,
        variant: { id: 'v1', price: null },
        overrides: [],
      });
      expect(price).toBe(100);
    });

    it('ignores override for a different variant', () => {
      const price = resolveEffectiveUnitPrice({
        inventorySellingPrice: 100,
        variant: { id: 'v1', price: 90 },
        overrides: [{ item_variant_id: 'v2', selling_price: 50 }],
      });
      expect(price).toBe(90);
    });
  });

  describe('activeCatalogVariants', () => {
    it('filters inactive variants', () => {
      const active = activeCatalogVariants([
        { id: 'a', is_active: true },
        { id: 'b', is_active: false },
        { id: 'c' },
      ]);
      expect(active.map((v) => v.id)).toEqual(['a', 'c']);
    });
  });
});
