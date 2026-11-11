import { loadRecentSearches, rememberSearch, type RecentSearchStore } from './recentRentalSearches';

function memoryStore(): RecentSearchStore {
  const box: { saved: unknown } = { saved: null };
  return {
    async getObject() {
      return box.saved as never;
    },
    async setObject(_key, value) {
      box.saved = value;
    },
  };
}

describe('recent rental searches', () => {
  it('keeps the newest term first and drops duplicates on this device', async () => {
    const store = memoryStore();
    await rememberSearch('speaker system', store);
    const next = await rememberSearch('Canon camera', store);
    const again = await rememberSearch('canon camera', store);
    expect(next[0]).toBe('Canon camera');
    expect(again).toEqual(['canon camera', 'speaker system']);
    expect(await loadRecentSearches(store)).toEqual(again);
  });

  it('does not store a term shorter than two characters', async () => {
    const store = memoryStore();
    const writes: unknown[] = [];
    const watched: RecentSearchStore = {
      getObject: (key) => store.getObject(key),
      setObject: async (key, value) => {
        writes.push(value);
        await store.setObject(key, value);
      },
    };
    expect(await rememberSearch(' a ', watched)).toEqual([]);
    expect(await rememberSearch('   ', watched)).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('ignores a corrupt saved list and drops blank entries', async () => {
    const store = memoryStore();
    await store.setObject('rentals.recentSearches.v1', { term: 'tent' });
    expect(await loadRecentSearches(store)).toEqual([]);
    await store.setObject('rentals.recentSearches.v1', [' tent ', '', '  ', 3, 'camera']);
    expect(await loadRecentSearches(store)).toEqual([' tent ', 'camera']);
  });

  it('keeps only the eight newest terms', async () => {
    const store = memoryStore();
    for (let i = 1; i <= 9; i += 1) {
      await rememberSearch(`item ${i}`, store);
    }
    const saved = await loadRecentSearches(store);
    expect(saved).toHaveLength(8);
    expect(saved[0]).toBe('item 9');
    expect(saved).not.toContain('item 1');
  });
});
