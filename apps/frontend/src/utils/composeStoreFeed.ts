import type { CollectionSummary } from '../hooks/useCollections';
import type { InventoryItem } from '../hooks/useInventoryItems';

export type StoreFeedStop =
  | { type: 'deals'; id: string; items: InventoryItem[] }
  | {
      type: 'popular';
      id: string;
      category_name: string;
      items: InventoryItem[];
    }
  | {
      type: 'collections';
      id: string;
      collections: CollectionSummary[];
    };

export type StoreFeedRow =
  | { type: 'products'; id: string; items: InventoryItem[] }
  | { type: 'stop'; stop: StoreFeedStop };

export interface ComposeStoreFeedInput {
  inventoryItems: InventoryItem[];
  productsPerChunk: number;
  suppressStops: boolean;
  deals: InventoryItem[];
  popular: Array<{ category_name: string; items: InventoryItem[] }>;
  collections: CollectionSummary[];
}

export function composeStoreFeed({
  inventoryItems,
  productsPerChunk,
  suppressStops,
  deals,
  popular,
  collections,
}: ComposeStoreFeedInput): StoreFeedRow[] {
  const chunkSize = Math.max(1, productsPerChunk);
  if (suppressStops) {
    return chunkProducts(inventoryItems, chunkSize);
  }

  const stops = buildStops(deals, popular, collections);
  const rows: StoreFeedRow[] = [];
  let productIndex = 0;
  let stopIndex = 0;

  while (productIndex < inventoryItems.length) {
    const chunk = inventoryItems.slice(
      productIndex,
      productIndex + chunkSize
    );
    rows.push({
      type: 'products',
      id: `products-${productIndex}`,
      items: chunk,
    });
    productIndex += chunk.length;
    if (stopIndex < stops.length) {
      rows.push({ type: 'stop', stop: stops[stopIndex] });
      stopIndex += 1;
    }
  }

  while (stopIndex < stops.length) {
    rows.push({ type: 'stop', stop: stops[stopIndex] });
    stopIndex += 1;
  }

  return rows;
}

function buildStops(
  deals: InventoryItem[],
  popular: Array<{ category_name: string; items: InventoryItem[] }>,
  collections: CollectionSummary[]
): StoreFeedStop[] {
  const stops: StoreFeedStop[] = [];
  if (deals.length > 0) {
    stops.push({ type: 'deals', id: 'stop-deals', items: deals });
  }
  popular.forEach((group, index) => {
    if (group.items.length > 0) {
      stops.push({
        type: 'popular',
        id: `stop-popular-${index}`,
        category_name: group.category_name,
        items: group.items,
      });
    }
  });
  if (collections.length > 0) {
    stops.push({
      type: 'collections',
      id: 'stop-collections',
      collections,
    });
  }
  return stops;
}

function chunkProducts(
  items: InventoryItem[],
  chunkSize: number
): StoreFeedRow[] {
  const rows: StoreFeedRow[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    rows.push({
      type: 'products',
      id: `products-${i}`,
      items: items.slice(i, i + chunkSize),
    });
  }
  return rows;
}
