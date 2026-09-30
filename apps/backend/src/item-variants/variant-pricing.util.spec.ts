import {
  activeCatalogVariants,
  packQuantityForOrderLine,
  packQuantityOf,
  packRebate,
  resolveEffectiveUnitPrice,
  stockUnitsForLine,
  sumBaseUnitsForItem,
  sumStockUnitsByInventory,
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

  describe('pack stock units', () => {
    it('treats missing quantity as one unit', () => {
      expect(packQuantityOf(null)).toBe(1);
      expect(stockUnitsForLine(2, 1)).toBe(2);
    });

    it('multiplies a pack of 10 by the line quantity', () => {
      expect(packQuantityOf({ quantity: 10 })).toBe(10);
      expect(stockUnitsForLine(2, 10)).toBe(20);
    });

    it('floors a fractional pack and treats invalid sizes as one unit', () => {
      expect(packQuantityOf({ quantity: '10.9' })).toBe(10);
      expect(packQuantityOf({ quantity: '0' })).toBe(1);
      expect(packQuantityOf({ quantity: -3 })).toBe(1);
      expect(packQuantityOf({ quantity: 'nope' })).toBe(1);
      expect(stockUnitsForLine(0, 10)).toBe(0);
      expect(stockUnitsForLine(Number.NaN, 10)).toBe(0);
    });

    it('prefers the purchase snapshot, then the inventory-row variant', () => {
      const live = {
        id: 'inv-1',
        item: { item_variants: [{ id: 'live', quantity: 6 }] },
      };
      expect(
        packQuantityForOrderLine({
          line: {
            business_inventory_id: 'inv-1',
            item_variant_id: 'live',
            variant_snapshot: { quantity: '' },
          },
          inventory: live,
        })
      ).toBe(6);
      expect(
        packQuantityForOrderLine({
          line: {
            business_inventory_id: 'inv-1',
            item_variant_id: 'requested',
            quantity: 1,
          },
          inventory: {
            id: 'inv-1',
            item_variant_id: 'row-pack',
            item_variant: { id: 'row-pack', quantity: 12 },
            item: { item_variants: [{ id: 'requested', quantity: 4 }] },
          },
        })
      ).toBe(12);
    });

    it('skips lines with no inventory id or a zero quantity', () => {
      const totals = sumStockUnitsByInventory(
        [
          { business_inventory_id: 'inv-1', quantity: 0 },
          { quantity: 2 },
          {
            business_inventory_id: 'inv-1',
            quantity: 1,
            variant_snapshot: { quantity: 4 },
          },
        ],
        []
      );
      expect(totals.get('inv-1')).toBe(4);
      expect(totals.size).toBe(1);
    });

    it('sums one pack of 10 plus 3 singles as 13 base units', () => {
      const inventory = {
        id: 'inv-1',
        item: {
          item_variants: [{ id: 'pack', quantity: 10 }],
        },
      };
      const totals = sumStockUnitsByInventory(
        [
          { business_inventory_id: 'inv-1', quantity: 1, item_variant_id: 'pack' },
          { business_inventory_id: 'inv-1', quantity: 3 },
        ],
        [inventory]
      );
      expect(totals.get('inv-1')).toBe(13);
      expect(
        packQuantityForOrderLine({
          line: {
            business_inventory_id: 'inv-1',
            variant_snapshot: { quantity: 10 },
          },
          inventory,
        })
      ).toBe(10);
    });

    it('adds parent singles and a variant pack for the same item', () => {
      const units = new Map<string, number>([
        ['parent', 8],
        ['pack-row', 10],
        ['other-item', 4],
      ]);
      const rows = [
        { id: 'parent', item: { id: 'item-1' } },
        { id: 'pack-row', item: { id: 'item-1' } },
        { id: 'other-item', item: { id: 'item-2' } },
      ];
      expect(sumBaseUnitsForItem(rows, 'item-1', units)).toBe(18);
    });
  });

  describe('packRebate', () => {
    it('hides a rebate for a single unit', () => {
      expect(
        packRebate({ packQuantity: 1, packPrice: 4, baseUnitPrice: 5 })
      ).toBeNull();
    });

    it('hides a rebate when the pack is not cheaper', () => {
      expect(
        packRebate({ packQuantity: 10, packPrice: 50, baseUnitPrice: 5 })
      ).toBeNull();
    });

    it('shows savings for a cheaper pack', () => {
      expect(
        packRebate({ packQuantity: 10, packPrice: 40, baseUnitPrice: 5 })
      ).toEqual({
        saveAmount: 10,
        perUnit: 4,
        savePercent: 20,
      });
    });
  });
});
