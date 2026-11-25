import { useMemo } from 'react';
import type { CollectionSummary } from '../types/collections';
import type { CatalogFeedStop } from '../types/catalogFeed';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import type { CatalogFeedRow } from './useCatalogFeedComposition';

export interface ComposeStoreFeedRowsInput {
  inventoryItems: CatalogInventoryItem[];
  suppressStops: boolean;
  dealsItems: CatalogInventoryItem[];
  popular: Array<{ category_name: string; items: CatalogInventoryItem[] }>;
  collections: CollectionSummary[];
}

/**
 * Store-scoped interrupted feed: deals → popular-in-category → collections.
 * Same product-pair rhythm as the marketplace catalog (4 items / 2 rows).
 */
export function composeStoreFeedRows({
  inventoryItems,
  suppressStops,
  dealsItems,
  popular,
  collections,
}: ComposeStoreFeedRowsInput): CatalogFeedRow[] {
  if (suppressStops) {
    return createProductRows(inventoryItems);
  }

  const stops = buildStops(dealsItems, popular, collections);
  const rows: CatalogFeedRow[] = [];
  let productIndex = 0;
  let stopIndex = 0;
  const productsPerChunk = 4;

  while (productIndex < inventoryItems.length) {
    const chunkEnd = Math.min(
      productIndex + productsPerChunk,
      inventoryItems.length
    );
    while (productIndex < chunkEnd) {
      rows.push({
        type: 'product-pair',
        id: `row-${productIndex}`,
        left: inventoryItems[productIndex],
        right: inventoryItems[productIndex + 1] || null,
      });
      productIndex += 2;
    }
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

export function useStoreFeedComposition(
  options: ComposeStoreFeedRowsInput
): CatalogFeedRow[] {
  return useMemo(
    () => composeStoreFeedRows(options),
    [
      options.inventoryItems,
      options.suppressStops,
      options.dealsItems,
      options.popular,
      options.collections,
    ]
  );
}

function buildStops(
  dealsItems: CatalogInventoryItem[],
  popular: Array<{ category_name: string; items: CatalogInventoryItem[] }>,
  collections: CollectionSummary[]
): CatalogFeedStop[] {
  const stops: CatalogFeedStop[] = [];
  if (dealsItems.length > 0) {
    stops.push({
      type: 'stop',
      stopType: 'deals',
      id: 'stop-deals',
      data: { items: dealsItems },
    });
  }
  popular.forEach((group, index) => {
    if (group.items.length > 0) {
      stops.push({
        type: 'stop',
        stopType: 'top-in-category',
        id: `stop-popular-${index}`,
        data: { items: group.items, category: group.category_name },
      });
    }
  });
  if (collections.length > 0) {
    stops.push({
      type: 'stop',
      stopType: 'collections',
      id: 'stop-collections',
      data: { collections },
    });
  }
  return stops;
}

function createProductRows(items: CatalogInventoryItem[]): CatalogFeedRow[] {
  const rows: CatalogFeedRow[] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push({
      type: 'product-pair',
      id: `row-${i}`,
      left: items[i],
      right: items[i + 1] || null,
    });
  }
  return rows;
}
