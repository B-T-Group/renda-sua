import type { CollectionSummary } from '../../hooks/useCollections';
import type { InventoryItem } from '../../hooks/useInventoryItems';

export interface CatalogCategoryTile {
  id: number;
  name: string;
  imageUrl: string | null;
  listingCount: number;
}

export interface CategoryCarouselModule {
  id: string;
  type: 'CATEGORY_CAROUSEL';
  title: string;
  items: CatalogCategoryTile[];
}

export interface CollectionCarouselModule {
  id: string;
  type: 'COLLECTION_CAROUSEL';
  title: string;
  items: CollectionSummary[];
}

export interface ProductCarouselModule {
  id: string;
  type: 'PRODUCT_CAROUSEL' | 'RECENTLY_VIEWED';
  title: string;
  subtitle?: string;
  products: InventoryItem[];
}

export interface ProductGridModule {
  id: string;
  type: 'PRODUCT_GRID';
  title: string;
  source: { path: string; query: Record<string, string> };
}

export type CatalogModule =
  | CategoryCarouselModule
  | CollectionCarouselModule
  | ProductCarouselModule
  | ProductGridModule;

export interface CatalogExperienceResponse {
  modules: CatalogModule[];
}

export function isVisualCatalogModule(module: CatalogModule): boolean {
  return module.type !== 'PRODUCT_GRID';
}
