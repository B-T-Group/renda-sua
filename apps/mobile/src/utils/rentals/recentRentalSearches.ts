const KEY = 'rentals.recentSearches.v1';
const MAX_RECENT = 8;

export interface RecentSearchStore {
  getObject<T>(key: string): Promise<T | null>;
  setObject<T>(key: string, value: T): Promise<void>;
}

export async function loadRecentSearches(store: RecentSearchStore): Promise<string[]> {
  const rows = await store.getObject<unknown>(KEY);
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is string => typeof row === 'string' && row.trim().length > 0).slice(0, MAX_RECENT);
}

export async function rememberSearch(term: string, store: RecentSearchStore): Promise<string[]> {
  const clean = term.trim();
  const prev = await loadRecentSearches(store);
  if (clean.length < 2) return prev;
  const next = [clean, ...prev.filter((row) => row.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
  await store.setObject(KEY, next);
  return next;
}
