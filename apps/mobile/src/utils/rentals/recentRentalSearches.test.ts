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
});
