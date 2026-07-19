import {
  resolveShopperVariant,
  ShopperVariantResolveException,
} from './resolve-shopper-variant.util';

describe('resolveShopperVariant', () => {
  const baseInventory = {
    item_variant_id: null as string | null,
    item: {
      item_variants: [
        { id: 'var-1', name: 'Large', is_active: true },
        { id: 'var-2', name: 'Small', is_active: true },
      ],
    },
  };

  it('returns null when item has no variants', () => {
    const result = resolveShopperVariant({
      requestedVariantId: undefined,
      inventoryRow: { item_variant_id: null, item: { item_variants: [] } },
    });
    expect(result).toBeNull();
  });

  it('returns null (base item) when variants exist but id is omitted', () => {
    const result = resolveShopperVariant({
      requestedVariantId: undefined,
      inventoryRow: baseInventory,
    });
    expect(result).toBeNull();
  });

  it('returns null (base item) for a single variant when id is omitted', () => {
    const result = resolveShopperVariant({
      requestedVariantId: '',
      inventoryRow: {
        item_variant_id: null,
        item: { item_variants: [{ id: 'var-1', name: 'Only' }] },
      },
    });
    expect(result).toBeNull();
  });

  it('returns the matching variant when id is provided', () => {
    const result = resolveShopperVariant({
      requestedVariantId: 'var-2',
      inventoryRow: baseInventory,
    }) as { id: string };
    expect(result.id).toBe('var-2');
  });

  it('throws ITEM_VARIANT_INVALID for unknown id', () => {
    expect(() =>
      resolveShopperVariant({
        requestedVariantId: 'missing',
        inventoryRow: baseInventory,
      })
    ).toThrow(ShopperVariantResolveException);
    try {
      resolveShopperVariant({
        requestedVariantId: 'missing',
        inventoryRow: baseInventory,
      });
    } catch (e: any) {
      expect(e.code).toBe('ITEM_VARIANT_INVALID');
    }
  });

  it('binds to per-variant inventory row', () => {
    const result = resolveShopperVariant({
      requestedVariantId: undefined,
      inventoryRow: {
        item_variant_id: 'var-1',
        item: { item_variants: baseInventory.item.item_variants },
      },
    }) as { id: string };
    expect(result.id).toBe('var-1');
  });

  it('throws ITEM_VARIANT_MISMATCH when request disagrees with stock row', () => {
    expect(() =>
      resolveShopperVariant({
        requestedVariantId: 'var-2',
        inventoryRow: {
          item_variant_id: 'var-1',
          item: { item_variants: baseInventory.item.item_variants },
        },
      })
    ).toThrow(
      expect.objectContaining({ code: 'ITEM_VARIANT_MISMATCH' })
    );
  });
});
