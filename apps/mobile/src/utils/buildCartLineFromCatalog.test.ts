import { describe, expect, it } from 'vitest';
import { buildCartLineFromCatalog } from './buildCartLineFromCatalog';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';

function makeCatalogItem(overrides: { country?: string } = {}): CatalogInventoryItem {
  return {
    id: 'inv-1',
    computed_available_quantity: 10,
    selling_price: 5000,
    is_active: true,
    business_location: {
      id: 'loc-1',
      business_id: 'biz-1',
      name: 'Shop A',
      business: { id: 'biz-1', name: 'Shop A' },
      address: {
        country: overrides.country ?? 'CM',
        city: 'Yaound',
        state: 'Centre',
        postal_code: null,
        address_line_1: '1 Main St',
        latitude: 3.87,
        longitude: 11.52,
      },
    },
    item: {
      id: 'item-1',
      name: 'Test Product',
      description: null,
      currency: 'XAF',
      weight: 0,
      min_order_quantity: 1,
      max_order_quantity: null,
      pay_on_delivery_enabled: false,
      item_variants: [],
      item_images: [],
    } as any,
    deals: [],
  } as unknown as CatalogInventoryItem;
}

describe('buildCartLineFromCatalog', () => {
  it('snapshots sellerCountry from business_location.address.country', () => {
    const line = buildCartLineFromCatalog(makeCatalogItem({ country: 'CM' }), 1, null);
    expect(line.sellerCountry).toBe('CM');
  });

  it('uppercases sellerCountry', () => {
    const line = buildCartLineFromCatalog(makeCatalogItem({ country: 'ca' }), 1, null);
    expect(line.sellerCountry).toBe('CA');
  });

  it('omits sellerCountry when country is absent', () => {
    const item = makeCatalogItem({ country: '' });
    (item.business_location.address as any).country = '';
    const line = buildCartLineFromCatalog(item, 1, null);
    expect(line.sellerCountry).toBeUndefined();
  });

  it('prices variant using location override before variant price', () => {
    const item = makeCatalogItem();
    item.item.item_variants = [{ id: 'variant-1', name: 'Large', price: 6000 }];
    item.variant_price_overrides = [{
      item_variant_id: 'variant-1',
      selling_price: 6500,
    }];
    const line = buildCartLineFromCatalog(item, 1, 'variant-1');
    expect(line.itemData.price).toBe(6500);
  });

  it('applies listing deal ratio to effective variant base', () => {
    const item = makeCatalogItem();
    item.item.item_variants = [{ id: 'variant-1', name: 'Large', price: 6000 }];
    item.hasActiveDeal = true;
    item.original_price = 5000;
    item.discounted_price = 4000;
    const line = buildCartLineFromCatalog(item, 1, 'variant-1');
    expect(line.itemData.price).toBe(4800);
  });

  it('throws when multi-variant listing has no selected variant', () => {
    const item = makeCatalogItem();
    item.item.item_variants = [
      { id: 'variant-1', name: 'Small', price: 4000 },
      { id: 'variant-2', name: 'Large', price: 6000 },
    ];
    expect(() => buildCartLineFromCatalog(item, 1)).toThrow('ITEM_VARIANT_REQUIRED');
  });
});
