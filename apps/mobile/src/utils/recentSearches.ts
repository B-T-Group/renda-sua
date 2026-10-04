import StorageService from '../services/storage/StorageService';

const KEY = '@Rendasua:recentSearches';
const LIMIT = 8;

export async function loadRecentSearches(): Promise<string[]> {
  const stored = await StorageService.getObject<string[]>(KEY);
  return Array.isArray(stored) ? stored.filter((row) => typeof row === 'string') : [];
}

export async function rememberSearch(term: string): Promise<string[]> {
  const cleaned = term.trim();
  if (cleaned.length < 2) return loadRecentSearches();
  const previous = await loadRecentSearches();
  const next = [cleaned, ...previous.filter((row) => row.toLowerCase() !== cleaned.toLowerCase())].slice(0, LIMIT);
  await StorageService.setObject(KEY, next);
  return next;
}
