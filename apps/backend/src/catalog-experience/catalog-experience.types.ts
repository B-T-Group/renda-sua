import type { CollectionSummary } from '../collections/collections.service';
import type { InventoryItem } from '../inventory-items/inventory-items.service';

export const CATALOG_CAROUSEL_LIMIT = 12;
export const MIN_CATEGORY_LISTINGS = 1;

export type CatalogLayout = 'discovery' | 'results';

export interface CatalogExperienceContext {
  userId?: string;
  clientId?: string;
  country?: string;
  state?: string;
  language: 'en' | 'fr';
  layout: CatalogLayout;
  device?: string;
  isReturning: boolean;
}

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
  source: {
    path: '/inventory-items';
    query: Record<string, string>;
  };
}

export type CatalogModule =
  | CategoryCarouselModule
  | CollectionCarouselModule
  | ProductCarouselModule
  | ProductGridModule;

export interface CatalogExperienceResponse {
  modules: CatalogModule[];
}

export interface CatalogModuleProvider {
  readonly id: string;
  supports(context: CatalogExperienceContext): boolean;
  build(context: CatalogExperienceContext): Promise<CatalogModule | null>;
}
