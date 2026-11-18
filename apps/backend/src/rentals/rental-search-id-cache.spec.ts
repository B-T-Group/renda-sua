import {
  RentalSearchIdCache,
  listingsInIdOrder,
  rentalSearchOrderKey,
} from './rental-search-id-cache';

const base = {
  country: 'CM',
  state: 'LT',
  q: 'Camera',
  categoryId: 'cat-1',
  sort: 'recommended',
  minPrice: 1000,
  maxPrice: 5000,
  startDate: '2026-11-22',
  endDate: '2026-11-25',
  operationMode: 'take_home',
  rankingEnabled: false,
  cardGuardEnabled: false,
};

describe('rentalSearchOrderKey', () => {
  it('keys the market filters and the ranking flag, and leaves out secrets', () => {
    const key = rentalSearchOrderKey(base);
    expect(key).toBe(rentalSearchOrderKey({ ...base, q: ' camera ' }));
    expect(key).not.toBe(rentalSearchOrderKey({ ...base, rankingEnabled: true }));
    expect(key).not.toBe(rentalSearchOrderKey({ ...base, minPrice: 2000 }));
    expect(key).not.toContain('Bearer');
    expect(key).not.toContain('secret');
    expect(key.split('|')).toEqual([
      'v1',
      'CM',
      'lt',
      'camera',
      'cat-1',
      'recommended',
      '1000',
      '5000',
      '2026-11-22',
      '2026-11-25',
      'take_home',
      '0',
      '0',
    ]);
  });
});

describe('RentalSearchIdCache', () => {
  it('expires an order and evicts the least recently used entry', () => {
    let now = 1_000;
    const cache = new RentalSearchIdCache(2, 500, () => now);
    cache.set('a', { ids: ['a1'], availableCount: 1 });
    cache.set('b', { ids: ['b1'], availableCount: 0 });
    expect(cache.get('a')?.ids).toEqual(['a1']);
    cache.set('c', { ids: ['c1'], availableCount: 0 });
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')?.ids).toEqual(['a1']);
    now = 1_600;
    expect(cache.get('a')).toBeNull();
    cache.set('d', { ids: ['d1'], availableCount: 1 });
    expect(cache.get('d')?.ids).toEqual(['d1']);
    now = 2_100;
    expect(cache.get('d')).toBeNull();
  });

  it('keeps the requested id order and drops a missing row', () => {
    expect(listingsInIdOrder(['b', 'a', 'c'], [{ id: 'a' }, { id: 'b' }]).map((row) => row.id)).toEqual(['b', 'a']);
  });
});

describe('ordered id paging at 50k', () => {
  it('pages from the cached id list instead of sorting the market again', () => {
    const ids = Array.from({ length: 50_000 }, (_, index) => `id-${index}`);
    const rows = ids.map((id, catalogIndex) => ({
      id,
      catalogIndex,
      available: catalogIndex % 17 !== 0,
    }));
    const cache = new RentalSearchIdCache(4, 60_000, () => 0);
    const fillStarted = performance.now();
    const ordered = [...rows].sort(compareBench);
    cache.set('CM|recommended', { ids: ordered.map((row) => row.id), availableCount: ordered.length });
    const fillMs = performance.now() - fillStarted;
    const warmStarted = performance.now();
    for (let page = 0; page < 100; page += 1) {
      const hit = cache.get('CM|recommended');
      hit!.ids.slice(page * 20, page * 20 + 20);
    }
    const warmMs = performance.now() - warmStarted;
    const coldStarted = performance.now();
    for (let page = 0; page < 3; page += 1) {
      const copy = [...rows].sort(compareBench);
      copy.slice(page * 20, page * 20 + 20);
    }
    const coldMs = performance.now() - coldStarted;
    const fat = ordered.map((row) => ({ id: row.id, name: 'camera', notes: 'x'.repeat(800), price: 25000 }));
    const fullBody = JSON.stringify(fat);
    const coldParseStarted = performance.now();
    JSON.parse(fullBody);
    const coldParseMs = performance.now() - coldParseStarted;
    const warmParseStarted = performance.now();
    JSON.parse(JSON.stringify(fat.slice(0, 20)));
    const warmParseMs = performance.now() - warmParseStarted;
    const note = [
      'RENTAL_ID_CACHE_BENCH',
      `fillMs=${fillMs.toFixed(2)}`,
      `warm100PagesMs=${warmMs.toFixed(2)}`,
      `cold3SortsMs=${coldMs.toFixed(2)}`,
      `payloadBytes=${fullBody.length}`,
      `coldParseMs=${coldParseMs.toFixed(2)}`,
      `warmPageParseMs=${warmParseMs.toFixed(2)}`,
    ].join(' ');
    console.info(note);
    expect(warmMs).toBeLessThan(coldMs);
    expect(warmParseMs).toBeLessThan(coldParseMs);
    expect(cache.get('CM|recommended')?.ids).toHaveLength(50_000);
  });
});

function compareBench(a: { catalogIndex: number; available: boolean }, b: { catalogIndex: number; available: boolean }): number {
  if (a.available !== b.available) return a.available ? -1 : 1;
  return a.catalogIndex - b.catalogIndex;
}
