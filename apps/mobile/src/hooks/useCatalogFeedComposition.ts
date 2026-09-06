import { useMemo } from 'react';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import type { CollectionSummary } from '../types/collections';
import type { CatalogStore } from '../types/stores';
import type { CatalogFeedStop } from '../types/catalogFeed';

export interface UseCatalogFeedCompositionOptions {
  /**
   * Main inventory items from the catalog grid.
   */
  inventoryItems: CatalogInventoryItem[];

  /**
   * When true, suppress all stops (e.g. search or filters active).
   */
  suppressStops: boolean;

  /**
   * Deals stop items from backend.
   */
  dealsItems: CatalogInventoryItem[];
  dealsLoading: boolean;

  /**
   * Top in category stop items from backend.
   */
  topInCategoryItems: CatalogInventoryItem[];
  topInCategoryName: string;
  topInCategoryLoading: boolean;

  /**
   * Bag complements stop items from backend.
   */
  bagComplementsItems: CatalogInventoryItem[];
  bagComplementsLoading: boolean;

  /**
   * Essentials/collections stop from backend.
   */
  collections: CollectionSummary[];
  collectionsLoading: boolean;

  /**
   * Featured stores stop from backend.
   */
  stores: CatalogStore[];
  storesLoading: boolean;
}

export type CatalogFeedRow =
  | { type: 'product-pair'; id: string; left: CatalogInventoryItem; right: CatalogInventoryItem | null }
  | { type: 'stop'; stop: CatalogFeedStop };

/**
 * Composes a feed by inserting "stops" between inventory product chunks.
 * 
 * Returns rows where each row is either:
 * - A pair of products (2-column grid row)
 * - A stop (full-width rail)
 * 
 * Rhythm: ~1-2 product rows → Goes with your bag → rows → Top in category → Deals → ...
 * 
 * Cold-start: omit stops when no data (backend returns empty arrays).
 */
export function useCatalogFeedComposition({
  inventoryItems,
  suppressStops,
  dealsItems,
  dealsLoading,
  topInCategoryItems,
  topInCategoryName,
  topInCategoryLoading,
  bagComplementsItems,
  bagComplementsLoading,
  collections,
  collectionsLoading,
  stores,
  storesLoading,
}: UseCatalogFeedCompositionOptions): CatalogFeedRow[] {
  return useMemo(() => {
    // If stops are suppressed (search/filters active), just return product pairs
    if (suppressStops) {
      return createProductRows(inventoryItems);
    }

    // Build stop candidates (only include stops with actual data from backend)
    const stops: CatalogFeedStop[] = [];

    // 1. "Goes with your bag" — only when backend returns items
    if (!bagComplementsLoading && bagComplementsItems.length > 0) {
      stops.push({
        type: 'stop',
        stopType: 'goes-with-bag',
        id: 'stop-goes-with-bag',
        data: { items: bagComplementsItems },
      });
    }

    // 2. "Top in {category}" — only when backend returns items
    if (!topInCategoryLoading && topInCategoryItems.length > 0) {
      stops.push({
        type: 'stop',
        stopType: 'top-in-category',
        id: 'stop-top-category',
        data: { items: topInCategoryItems, category: topInCategoryName },
      });
    }

    // 3. "Collections" (Essentials) — only when backend returns collections
    if (!collectionsLoading && collections.length > 0) {
      stops.push({
        type: 'stop',
        stopType: 'collections',
        id: 'stop-collections',
        data: { collections },
      });
    }

    // 4. "Deals" — only when backend returns deal items
    if (!dealsLoading && dealsItems.length > 0) {
      stops.push({
        type: 'stop',
        stopType: 'deals',
        id: 'stop-deals',
        data: { items: dealsItems },
      });
    }

    // 5. "Featured stores" — only when backend returns stores
    if (!storesLoading && stores.length > 0) {
      stops.push({
        type: 'stop',
        stopType: 'stores',
        id: 'stop-stores',
        data: { stores },
      });
    }

    // Insert stops between product chunks with a warm rhythm
    // Rhythm: ~2 rows (4 items) → stop → rows → stop → ...
    const rows: CatalogFeedRow[] = [];
    let productIndex = 0;
    let stopIndex = 0;
    const productsPerChunk = 4; // 2 rows in a 2-col grid

    while (productIndex < inventoryItems.length) {
      // Add a chunk of products
      const chunkEnd = Math.min(productIndex + productsPerChunk, inventoryItems.length);
      while (productIndex < chunkEnd) {
        const left = inventoryItems[productIndex];
        const right = inventoryItems[productIndex + 1] || null;
        rows.push({
          type: 'product-pair',
          id: `row-${productIndex}`,
          left,
          right,
        });
        productIndex += 2;
      }

      // Insert next stop if available
      if (stopIndex < stops.length) {
        rows.push({
          type: 'stop',
          stop: stops[stopIndex],
        });
        stopIndex += 1;
      }
    }

    // Append any remaining stops at the end
    while (stopIndex < stops.length) {
      rows.push({
        type: 'stop',
        stop: stops[stopIndex],
      });
      stopIndex += 1;
    }

    return rows;
  }, [
    inventoryItems,
    suppressStops,
    dealsItems,
    dealsLoading,
    topInCategoryItems,
    topInCategoryName,
    topInCategoryLoading,
    bagComplementsItems,
    bagComplementsLoading,
    collections,
    collectionsLoading,
    stores,
    storesLoading,
  ]);
}

function createProductRows(items: CatalogInventoryItem[]): CatalogFeedRow[] {
  const rows: CatalogFeedRow[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1] || null;
    rows.push({
      type: 'product-pair',
      id: `row-${i}`,
      left,
      right,
    });
  }
  return rows;
}
