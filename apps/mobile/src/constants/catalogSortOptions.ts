import type { InventorySortMode } from '../types/inventoryCatalog';

export const CATALOG_SORT_OPTIONS: {
  key: InventorySortMode;
  labelKey: string;
  labelDefault: string;
}[] = [
  { key: 'relevance', labelKey: 'public.items.sort.forYou', labelDefault: 'For you' },
  { key: 'fastest', labelKey: 'public.items.sort.nearest', labelDefault: 'Nearest' },
  { key: 'cheapest', labelKey: 'public.items.sort.cheapest', labelDefault: 'Cheapest' },
  { key: 'top_rated', labelKey: 'public.items.sort.topRated', labelDefault: 'Top rated' },
  { key: 'deals', labelKey: 'public.items.sort.deals', labelDefault: 'Deals' },
];
