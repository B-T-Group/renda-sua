import { composeStoreFeedRows } from './useStoreFeedComposition';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import type { CollectionSummary } from '../types/collections';

function item(id: string): CatalogInventoryItem {
  return { id } as CatalogInventoryItem;
}

function collection(slug: string): CollectionSummary {
  return {
    id: slug,
    slug,
    name: slug,
    description: null,
    image_url: null,
    is_featured: false,
    sort_order: 0,
    listing_count: 1,
  };
}

describe('composeStoreFeedRows', () => {
  it('suppresses stops when filters are active', () => {
    const rows = composeStoreFeedRows({
      inventoryItems: [item('a'), item('b'), item('c')],
      suppressStops: true,
      dealsItems: [item('deal')],
      popular: [{ category_name: 'Home', items: [item('p1')] }],
      collections: [collection('essentials')],
    });
    expect(rows.every((row) => row.type === 'product-pair')).toBe(true);
  });

  it('inserts store-only stops between product chunks', () => {
    const rows = composeStoreFeedRows({
      inventoryItems: [
        item('1'),
        item('2'),
        item('3'),
        item('4'),
        item('5'),
        item('6'),
        item('7'),
        item('8'),
      ],
      suppressStops: false,
      dealsItems: [item('deal')],
      popular: [{ category_name: 'Home', items: [item('p1')] }],
      collections: [collection('essentials')],
    });
    expect(rows.map((row) => row.type)).toEqual([
      'product-pair',
      'product-pair',
      'stop',
      'product-pair',
      'product-pair',
      'stop',
      'stop',
    ]);
    const stops = rows.filter((row) => row.type === 'stop');
    expect(stops[0].type === 'stop' && stops[0].stop.stopType).toBe('deals');
    expect(stops[1].type === 'stop' && stops[1].stop.stopType).toBe(
      'top-in-category'
    );
    expect(stops[2].type === 'stop' && stops[2].stop.stopType).toBe(
      'collections'
    );
  });
});
