import { DiscoveryRecoveryService } from './discovery-recovery.service';

const NOW = Date.parse('2026-10-11T12:00:00Z');
const item = (id: string, cat = 'Food') =>
  ({ id, item_id: id, item: { item_sub_category: { item_category: { id: 1, name: cat } } } }) as any;

function make(over: {
  vocab?: string[];
  counts?: (q: any) => number;
  similarIds?: string[];
  flags?: Record<string, boolean>;
  listFails?: boolean;
} = {}) {
  const items = {
    resolveSearchScope: jest.fn(async (s?: string) => (s ? { searchTextQuery: s } : {})),
    countCatalogMatches: jest.fn(async (q: any) => (over.counts ? over.counts(q) : 0)),
    similarItemIdsForQuery: jest.fn(async () => over.similarIds ?? []),
    getInventoryItems: jest.fn(async (q: any) => {
      if (over.listFails) throw new Error('boom');
      return { items: q.similar_item_ids ? [item('sim1', 'Drinks')] : [item('p1'), item('p2', 'Grocery')] };
    }),
  };
  const flags = { discovery_sort_v1: true, assistant_shopping_v1: false, ...over.flags };
  const hasura = {
    executeQuery: jest.fn(async (q: string) => {
      if (q.includes('DiscoveryFlags')) {
        return {
          application_configurations: Object.entries(flags).map(([config_key, boolean_value]) => ({
            config_key, country_code: null, boolean_value,
          })),
        };
      }
      return {
        business_inventory: (over.vocab ?? ['Samsung TV', 'Rice Cooker']).map((name) => ({ item: { name } })),
      };
    }),
  };
  const svc = new DiscoveryRecoveryService(items as any, hasura as any);
  return { svc, items, hasura };
}

describe('DiscoveryRecoveryService', () => {
  it('R1: a confident correction that returns results is offered; one that returns none is not', async () => {
    const hit = make({ counts: (q) => (q.search === 'samsung tv' ? 4 : 0) });
    const r = await hit.svc.recover({ search: 'samsnug tv', country_code: 'CM' }, NOW);
    expect(r.corrected_query).toBe('samsung tv');
    expect(r.corrected_total).toBe(4);
    expect(r.first_rung).toBe('R1');

    const miss = make({ counts: () => 0 });
    const r2 = await miss.svc.recover({ search: 'samsnug tv', country_code: 'CM' }, NOW);
    expect(r2.corrected_query).toBeNull();
  });

  it('R2: lists each active filter whose removal unlocks results, with the count, largest first', async () => {
    const { svc } = make({
      counts: (q) => {
        if (q.search !== 'rice') return 0;
        if (!('brand' in q)) return 7; // brand removal unlocks 7
        if (!('max_price' in q)) return 2;
        return 0;
      },
    });
    const r = await svc.recover(
      { search: 'rice', brand: 'Acme', max_price: 100, category: 'Food', country_code: 'CM' },
      NOW
    );
    expect(r.relax).toEqual([
      { filter: 'brand', value: 'Acme', count: 7 },
      { filter: 'max_price', value: '100', count: 2 },
    ]);
    expect(r.first_rung).toBe('R2');
  });

  it('R2: removing a category also removes its subcategory', async () => {
    const { svc, items } = make({ counts: () => 0 });
    await svc.recover({ search: 'rice', category: 'Food', subcategory: 'Grains', country_code: 'CM' }, NOW);
    const withoutCategory = items.countCatalogMatches.mock.calls.map((c) => c[0]).find((q: any) => !('category' in q));
    expect(withoutCategory).toBeDefined();
    expect('subcategory' in (withoutCategory as any)).toBe(false);
  });

  it('R3: similar items come from the loose embedding lookup, sold-out allowed, restricted to those ids', async () => {
    const { svc, items } = make({ similarIds: ['x', 'y'] });
    const r = await svc.recover({ search: 'zzqq', country_code: 'CM' }, NOW);
    expect(r.similar.map((i) => i.id)).toEqual(['sim1']);
    const call = items.getInventoryItems.mock.calls.find((c) => c[0].similar_item_ids)![0];
    expect(call.similar_item_ids).toEqual(['x', 'y']);
    expect(call.include_unavailable).toBe(true);
    expect(r.first_rung).toBe('R3');
  });

  it('R4 is the guaranteed floor: popular in-stock items + 1-3 categories, even with nothing else', async () => {
    const { svc, items } = make();
    const r = await svc.recover({ search: 'zzqq', country_code: 'CM' }, NOW);
    expect(r.popular_near_you.length).toBeGreaterThan(0);
    expect(r.categories.length).toBeGreaterThanOrEqual(1);
    expect(r.categories.length).toBeLessThanOrEqual(3);
    expect(r.first_rung).toBe('R4');
    const popularCall = items.getInventoryItems.mock.calls.find((c) => c[0].discovery?.sort === 'popular')![0];
    expect(popularCall.include_unavailable).toBe(false); // AC-3.4: in stock only
    expect(popularCall.country_code).toBe('CM'); // market only, no country question
  });

  it('R4 still returns an (empty) shape when the listing read fails, never throwing', async () => {
    const { svc } = make({ listFails: true });
    const r = await svc.recover({ search: 'zzqq', country_code: 'CM' }, NOW);
    expect(r.popular_near_you).toEqual([]);
    expect(r.enabled).toBe(true);
  });

  it('R5 follows assistant_shopping_v1 only', async () => {
    expect((await make({ flags: { assistant_shopping_v1: true } }).svc.recover({ search: 'q', country_code: 'CM' }, NOW)).ask_renda).toEqual({ enabled: true, query: 'q' });
    expect((await make().svc.recover({ search: 'q', country_code: 'CM' }, NOW)).ask_renda.enabled).toBe(false);
  });

  describe('flagEnabled', () => {
    const rowsHasura = (rows: any[], fail = false) => ({
      executeQuery: jest.fn(async () => {
        if (fail) throw new Error('down');
        return { application_configurations: rows };
      }),
    });
    const row = (country_code: string | null, boolean_value: boolean | null, config_key = 'discovery_sort_v1') => ({
      config_key, country_code, boolean_value,
    });

    it('country row beats global row, global beats default', async () => {
      const svc = new DiscoveryRecoveryService({} as any, rowsHasura([row(null, false), row('CM', true)]) as any);
      expect(await svc.flagEnabled('CM')).toBe(true);
      expect(await svc.flagEnabled('cm')).toBe(true);
      expect(await svc.flagEnabled('GA')).toBe(false);
      expect(await svc.flagEnabled(undefined)).toBe(false);
      const on = new DiscoveryRecoveryService({} as any, rowsHasura([row(null, true), row('GA', false)]) as any);
      expect(await on.flagEnabled('CM')).toBe(true);
      expect(await on.flagEnabled('GA')).toBe(false);
    });
    it('missing rows mean off, other keys are ignored', async () => {
      const svc = new DiscoveryRecoveryService({} as any, rowsHasura([row(null, true, 'other')]) as any);
      expect(await svc.flagEnabled('CM')).toBe(false);
    });
    it('one query serves many requests across markets (30 s cache) and fails closed', async () => {
      const h = rowsHasura([row(null, true)]);
      const svc = new DiscoveryRecoveryService({} as any, h as any);
      await Promise.all(['CM', 'GA', 'CG', 'CM'].map((c) => svc.flagEnabled(c)));
      await svc.flagEnabled('CM');
      expect(h.executeQuery).toHaveBeenCalledTimes(1);
      const bad = new DiscoveryRecoveryService({} as any, rowsHasura([], true) as any);
      expect(await bad.flagEnabled('CM')).toBe(false);
    });
  });
});
