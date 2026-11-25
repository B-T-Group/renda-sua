import { composeStoreFeed } from './composeStoreFeed';
import type { InventoryItem } from '../hooks/useInventoryItems';
import type { CollectionSummary } from '../hooks/useCollections';

function item(id: string): InventoryItem {
  return { id } as InventoryItem;
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

describe('composeStoreFeed', () => {
  it('suppresses stops when filters are active', () => {
    const rows = composeStoreFeed({
      inventoryItems: [item('a'), item('b'), item('c')],
      productsPerChunk: 2,
      suppressStops: true,
      deals: [item('deal')],
      popular: [{ category_name: 'Home', items: [item('p1'), item('p2')] }],
      collections: [collection('essentials')],
    });
    expect(rows.every((row) => row.type === 'products')).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('inserts deals, popular, then collections between product chunks', () => {
    const rows = composeStoreFeed({
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
      productsPerChunk: 4,
      suppressStops: false,
      deals: [item('deal')],
      popular: [{ category_name: 'Home', items: [item('p1')] }],
      collections: [collection('essentials')],
    });
    expect(rows.map((row) => row.type)).toEqual([
      'products',
      'stop',
      'products',
      'stop',
      'stop',
    ]);
    expect(rows[1].type === 'stop' && rows[1].stop.type).toBe('deals');
    expect(rows[3].type === 'stop' && rows[3].stop.type).toBe('popular');
    expect(rows[4].type === 'stop' && rows[4].stop.type).toBe('collections');
  });

  it('skips empty rails', () => {
    const rows = composeStoreFeed({
      inventoryItems: [item('1'), item('2')],
      productsPerChunk: 4,
      suppressStops: false,
      deals: [],
      popular: [{ category_name: 'Home', items: [] }],
      collections: [],
    });
    expect(rows).toEqual([
      { type: 'products', id: 'products-0', items: [item('1'), item('2')] },
    ]);
  });
});
