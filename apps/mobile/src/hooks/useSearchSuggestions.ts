import { useEffect, useState } from 'react';
import { publicApiGet } from '../services/publicApiClient';

export type SearchSuggestion =
  | { kind: 'term'; value: string }
  | { kind: 'product'; inventoryId: string; title: string; price: number; currency: string }
  | { kind: 'category'; value: string }
  | { kind: 'seller'; businessId: string; name: string };

export function useSearchSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      void publicApiGet<{ data?: { suggestions?: SearchSuggestion[] } }>(
        '/inventory-items/search/suggestions',
        { q }
      )
        .then((response) => {
          if (!cancelled) setSuggestions(response.data?.suggestions ?? []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { suggestions, loading };
}
