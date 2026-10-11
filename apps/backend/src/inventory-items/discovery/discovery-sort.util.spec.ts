import type { InventoryItem } from '../inventory-items.service';
import {
  bayesianRating,
  buildComparator,
  firstListedByItem,
  marketMeanRating,
  preferInStockListings,
  resolveDiscoverySort,
  sortControlState,
  sortDiscovery,
  stockFirstStable,
  trustSignals,
} from './discovery-sort.util';

const NOW = Date.parse('2026-10-11T12:00:00Z');
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function row(over: Partial<InventoryItem> & { item_id: string }): InventoryItem {
  return {
    id: `inv-${over.item_id}`,
    business_location_id: 'loc',
    computed_available_quantity: 5,
    selling_price: 10,
    is_active: true,
    created_at: day(60),
    updated_at: day(60),
    avg_rating: null,
    rating_count: null,
    ...over,
  } as InventoryItem;
}
const ids = (xs: InventoryItem[]) => xs.map((x) => x.item_id);

describe('bayesianRating', () => {
  it('shrinks small samples toward the market mean (m = 5)', () => {
    // one 5-star review in a 4.0 market: (1*5 + 5*4) / 6 = 4.1667
    expect(bayesianRating(5, 1, 4)).toBeCloseTo(4.1667, 3);
    // 100 reviews of 4.5 barely moves
    expect(bayesianRating(4.5, 100, 4)).toBeCloseTo(4.476, 2);
  });
  it('is null for unrated items (they rank below rated)', () => {
    expect(bayesianRating(null, 0, 4)).toBeNull();
    expect(bayesianRating(5, 0, 4)).toBeNull();
  });
  it('market mean is review-weighted', () => {
    const mean = marketMeanRating([
      row({ item_id: 'a', avg_rating: 5, rating_count: 1 }),
      row({ item_id: 'b', avg_rating: 3, rating_count: 3 }),
      row({ item_id: 'c' }),
    ]);
    expect(mean).toBeCloseTo((5 + 9) / 4, 5);
  });
});

describe('sortDiscovery', () => {
  const rated = [
    row({ item_id: 'many-good', avg_rating: 4.6, rating_count: 40 }),
    row({ item_id: 'one-perfect', avg_rating: 5, rating_count: 1 }),
    row({ item_id: 'unrated' }),
    row({ item_id: 'mid', avg_rating: 4.0, rating_count: 10 }),
  ];

  it('rating: Bayesian order, unrated last, one lucky 5-star does not beat 40 good reviews', () => {
    const mean = marketMeanRating(rated);
    const out = sortDiscovery(rated, 'rating', { ratingMean: mean });
    expect(ids(out)).toEqual(['many-good', 'one-perfect', 'mid', 'unrated']);
  });

  it('popular: 30-day count first, ties by 90-day, then newest', () => {
    const items = [
      row({ item_id: 'a', created_at: day(5) }),
      row({ item_id: 'b', created_at: day(50) }),
      row({ item_id: 'c', created_at: day(40) }),
      row({ item_id: 'd', created_at: day(10) }),
    ];
    const popularity = new Map([
      ['a', { d30: 2, d90: 2 }],
      ['b', { d30: 5, d90: 6 }],
      ['c', { d30: 5, d90: 20 }],
    ]);
    expect(ids(sortDiscovery(items, 'popular', { popularity }))).toEqual([
      'c', // same 30d as b, more 90d
      'b',
      'a',
      'd', // no orders: after ordered items
    ]);
  });

  it('newest: first listed date, using the earliest listing of the item', () => {
    const items = [
      row({ item_id: 'old-item', id: 'x1', created_at: day(100) }),
      row({ item_id: 'old-item', id: 'x2', created_at: day(1) }),
      row({ item_id: 'fresh', created_at: day(10) }),
    ];
    const firstListed = firstListedByItem(items);
    const winners = [items[1], items[2]]; // newest listing of old-item must not make it "new"
    expect(ids(sortDiscovery(winners, 'newest', { firstListed }))).toEqual([
      'fresh',
      'old-item',
    ]);
  });

  it.each(['popular', 'rating', 'newest', 'recommended'] as const)(
    '%s: in stock always before sold out, sold-out still present',
    (mode) => {
      const items = [
        row({ item_id: 'soldout-best', computed_available_quantity: 0, avg_rating: 5, rating_count: 50, created_at: day(1) }),
        row({ item_id: 'instock-meh', avg_rating: 3, rating_count: 4, created_at: day(90) }),
        row({ item_id: 'instock-none', created_at: day(95) }),
      ];
      const out = sortDiscovery(items, mode, {
        popularity: new Map([['soldout-best', { d30: 99, d90: 99 }]]),
        ratingMean: 4,
        blendScore: new Map([['soldout-best', 100]]),
      });
      expect(out).toHaveLength(3);
      expect(ids(out)[2]).toBe('soldout-best');
    }
  );

  it('is a total order: shuffled input gives the same pages (stable pagination)', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      row({
        item_id: `item-${String(i).padStart(2, '0')}`,
        created_at: day(i % 3), // many ties
        avg_rating: i % 2 ? 4 : null,
        rating_count: i % 2 ? 5 : null,
      })
    );
    const ctx = { ratingMean: 4, popularity: new Map(), firstListed: firstListedByItem(items) };
    for (const mode of ['popular', 'rating', 'newest', 'recommended'] as const) {
      const a = ids(sortDiscovery(items, mode, ctx));
      const b = ids(sortDiscovery([...items].reverse(), mode, ctx));
      expect(b).toEqual(a);
    }
  });

  it('comparator does not mutate its input', () => {
    const items = [row({ item_id: 'b' }), row({ item_id: 'a' })];
    sortDiscovery(items, 'newest', {});
    expect(ids(items)).toEqual(['b', 'a']);
    expect(typeof buildComparator('newest', {})).toBe('function');
  });
});

describe('stock helpers', () => {
  it('stockFirstStable keeps the relevance order inside each group', () => {
    const items = [
      row({ item_id: 'o1', computed_available_quantity: 0 }),
      row({ item_id: 'i1' }),
      row({ item_id: 'o2', computed_available_quantity: 0 }),
      row({ item_id: 'i2' }),
    ];
    expect(ids(stockFirstStable(items))).toEqual(['i1', 'i2', 'o1', 'o2']);
  });
  it('preferInStockListings drops sold-out rows of an item that has stock elsewhere', () => {
    const items = [
      row({ item_id: 'x', id: 'sold', computed_available_quantity: 0 }),
      row({ item_id: 'x', id: 'live' }),
      row({ item_id: 'y', id: 'only-sold', computed_available_quantity: 0 }),
    ];
    expect(preferInStockListings(items).map((i) => i.id)).toEqual(['live', 'only-sold']);
  });
});

describe('trustSignals (AC-2.x)', () => {
  it('shows the rating from 3 reviews and never below', () => {
    expect(trustSignals(row({ item_id: 'a', avg_rating: 4.64, rating_count: 23 }), NOW).rating_display).toEqual({ rating: 4.6, count: 23 });
    expect(trustSignals(row({ item_id: 'a', avg_rating: 5, rating_count: 2 }), NOW).rating_display).toBeNull();
    expect(trustSignals(row({ item_id: 'a' }), NOW).rating_display).toBeNull();
  });
  it('New chip within 14 days, and only instead of a rating', () => {
    expect(trustSignals(row({ item_id: 'a', created_at: day(14) }), NOW).is_new).toBe(true);
    expect(trustSignals(row({ item_id: 'a', created_at: day(15) }), NOW).is_new).toBe(false);
    const both = trustSignals(row({ item_id: 'a', created_at: day(2), avg_rating: 4.8, rating_count: 9 }), NOW);
    expect(both.rating_display).not.toBeNull();
    expect(both.is_new).toBe(false);
  });
});

describe('sortControlState (AC-1.7)', () => {
  it('hides under 2, disables under 4, enables otherwise', () => {
    expect([0, 1, 2, 3, 4, 50].map(sortControlState)).toEqual([
      'hidden', 'hidden', 'disabled', 'disabled', 'enabled', 'enabled',
    ]);
  });
});

describe('resolveDiscoverySort (AC-1.1)', () => {
  it('browse defaults to recommended, search to relevance', () => {
    expect(resolveDiscoverySort({ hasSearch: false })).toBe('recommended');
    expect(resolveDiscoverySort({ hasSearch: true })).toBe('relevance');
  });
  it('recommended is not available on search', () => {
    expect(resolveDiscoverySort({ requested: 'recommended', hasSearch: true })).toBe('relevance');
  });
  it('honours explicit new modes', () => {
    for (const m of ['popular', 'rating', 'newest', 'relevance']) {
      expect(resolveDiscoverySort({ requested: m, hasSearch: true })).toBe(m);
      expect(resolveDiscoverySort({ requested: m, hasSearch: false })).toBe(m);
    }
  });
  it('leaves legacy sorts (fastest, cheapest, top_rated, deals) on the old path', () => {
    for (const legacy of ['fastest', 'cheapest', 'top_rated', 'deals']) {
      expect(resolveDiscoverySort({ requested: legacy, legacySort: legacy, hasSearch: false })).toBeUndefined();
    }
  });
});
