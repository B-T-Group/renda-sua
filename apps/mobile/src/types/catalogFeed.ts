import type { CatalogInventoryItem } from './inventoryCatalog';
import type { CollectionSummary } from './collections';
import type { CatalogStore } from './stores';

export type CatalogFeedStopType =
  | 'goes-with-bag'
  | 'top-in-category'
  | 'deals'
  | 'collections'
  | 'stores';

export interface CatalogFeedStop {
  type: 'stop';
  stopType: CatalogFeedStopType;
  id: string;
  data: {
    items?: CatalogInventoryItem[];
    collections?: CollectionSummary[];
    stores?: CatalogStore[];
    category?: string;
  };
}

export interface CatalogFeedProduct {
  type: 'product';
  item: CatalogInventoryItem;
}

export type CatalogFeedItem = CatalogFeedProduct | CatalogFeedStop;
