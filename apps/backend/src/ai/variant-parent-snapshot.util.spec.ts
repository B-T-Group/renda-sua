import {
  buildVariantParentSnapshot,
  sanitizeVariantImageIds,
} from './variant-parent-snapshot.util';

describe('sanitizeVariantImageIds', () => {
  it('dedupes, drops blanks, and caps at 8 images', () => {
    const ids = [
      'a',
      'b',
      'a',
      '',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
    ];
    expect(sanitizeVariantImageIds(ids)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
    ]);
  });

  it('returns empty when no usable ids are provided', () => {
    expect(sanitizeVariantImageIds(undefined)).toEqual([]);
    expect(sanitizeVariantImageIds(['', null, undefined])).toEqual([]);
  });
});

describe('buildVariantParentSnapshot', () => {
  it('locks parent price/currency and lists existing variant names/skus', () => {
    expect(
      buildVariantParentSnapshot({
        name: 'Sneaker',
        description: 'Parent',
        sku: 'SNK-PARENT',
        color: 'Black',
        weight: 0.8,
        weight_unit: 'kg',
        dimensions: '30x20x12',
        price: 25000,
        currency: 'XAF',
        brand: { name: 'Kumba' },
        item_variants: [
          { name: 'Red / 42', sku: 'SNK-RED-42' },
          { name: '   ', sku: null },
          { name: 'Blue / 41', sku: '' },
        ],
      })
    ).toEqual({
      locked_price: 25000,
      locked_currency: 'XAF',
      name: 'Sneaker',
      description: 'Parent',
      sku: 'SNK-PARENT',
      color: 'Black',
      weight: 0.8,
      weight_unit: 'kg',
      dimensions: '30x20x12',
      brand: 'Kumba',
      existing_variant_names: ['Red / 42', 'Blue / 41'],
      existing_variant_skus: ['SNK-RED-42'],
    });
  });

  it('uses empty arrays when the parent has no variants', () => {
    const snapshot = buildVariantParentSnapshot({
      price: 1000,
      currency: 'XOF',
    });
    expect(snapshot.existing_variant_names).toEqual([]);
    expect(snapshot.existing_variant_skus).toEqual([]);
    expect(snapshot.brand).toBeNull();
  });
});
