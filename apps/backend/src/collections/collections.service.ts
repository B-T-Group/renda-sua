import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  GetInventoryItemsQuery,
  InventoryItemsService,
  PaginatedInventoryItems,
} from '../inventory-items/inventory-items.service';
import {
  localizeCollectionRow,
  resolveCollectionLang,
} from './collection-localization.util';

export interface CollectionSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  listing_count: number;
}

export interface GetCollectionsQuery {
  search?: string;
  featured?: boolean;
  country_code?: string;
  state?: string;
  origin_lat?: number;
  origin_lng?: number;
  lang?: string;
  min_listings?: number;
}

const MIN_COLLECTION_LISTINGS = 4;

const LIST_COLLECTIONS_GQL = `
  query ListCollections($where: collections_bool_exp!) {
    collections(where: $where, order_by: [{ sort_order: asc }, { name_en: asc }]) {
      id
      slug
      name_en
      name_fr
      description_en
      description_fr
      image_url
      is_featured
      sort_order
    }
  }
`;

const COLLECTION_BY_SLUG_GQL = `
  query CollectionBySlug($slug: String!) {
    collections(where: { slug: { _eq: $slug } }, limit: 1) {
      id
      slug
      name_en
      name_fr
      description_en
      description_fr
      image_url
      is_featured
      sort_order
    }
  }
`;

@Injectable()
export class CollectionsService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly inventoryItemsService: InventoryItemsService
  ) {}

  async listCollections(
    query: GetCollectionsQuery,
    acceptLanguage?: string
  ): Promise<CollectionSummary[]> {
    const lang = resolveCollectionLang(query.lang, acceptLanguage);
    const minListings = query.min_listings ?? MIN_COLLECTION_LISTINGS;
    const counts = await this.inventoryItemsService.countListingCountsByCollectionSlug(
      this.toCatalogQuery(query)
    );
    const where: Record<string, unknown> = {};
    if (query.featured === true) {
      where.is_featured = { _eq: true };
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      where._or = [
        { name_en: { _ilike: term } },
        { name_fr: { _ilike: term } },
        { slug: { _ilike: term } },
      ];
    }
    const result = await this.hasuraSystemService.executeQuery(
      LIST_COLLECTIONS_GQL,
      { where: Object.keys(where).length ? where : {} }
    );
    const rows = result?.collections ?? [];
    return rows
      .map((row: any) => {
        const listing_count = counts.get(row.slug) ?? 0;
        const localized = localizeCollectionRow(row, lang);
        return {
          id: row.id,
          slug: row.slug,
          name: localized.name,
          description: localized.description,
          image_url: row.image_url ?? null,
          is_featured: row.is_featured,
          sort_order: row.sort_order,
          listing_count,
        };
      })
      .filter((c: CollectionSummary) => c.listing_count >= minListings);
  }

  async getCollectionBySlug(
    slug: string,
    lang?: string,
    acceptLanguage?: string
  ): Promise<CollectionSummary | null> {
    const resolvedLang = resolveCollectionLang(lang, acceptLanguage);
    const result = await this.hasuraSystemService.executeQuery(
      COLLECTION_BY_SLUG_GQL,
      { slug }
    );
    const row = result?.collections?.[0];
    if (!row) return null;
    const localized = localizeCollectionRow(row, resolvedLang);
    return {
      id: row.id,
      slug: row.slug,
      name: localized.name,
      description: localized.description,
      image_url: row.image_url ?? null,
      is_featured: row.is_featured,
      sort_order: row.sort_order,
      listing_count: 0,
    };
  }

  async getCollectionWithProducts(
    slug: string,
    catalogQuery: GetInventoryItemsQuery,
    acceptLanguage?: string
  ): Promise<{
    collection: CollectionSummary;
    products: PaginatedInventoryItems;
  }> {
    const collection = await this.getCollectionBySlug(
      slug,
      undefined,
      acceptLanguage
    );
    if (!collection) {
      throw new HttpException(
        { success: false, message: 'Collection not found' },
        HttpStatus.NOT_FOUND
      );
    }
    const products = await this.inventoryItemsService.getInventoryItems({
      ...catalogQuery,
      collection: slug,
    });
    const counts = await this.inventoryItemsService.countListingCountsByCollectionSlug(
      this.toCatalogQuery(catalogQuery)
    );
    collection.listing_count = counts.get(slug) ?? products.total;
    if (collection.listing_count < MIN_COLLECTION_LISTINGS) {
      throw new HttpException(
        { success: false, message: 'Collection not available in your area' },
        HttpStatus.NOT_FOUND
      );
    }
    return { collection, products };
  }

  private toCatalogQuery(
    query: GetCollectionsQuery
  ): Pick<
    GetInventoryItemsQuery,
    'country_code' | 'state' | 'origin_lat' | 'origin_lng'
  > {
    return {
      country_code: query.country_code,
      state: query.state,
      origin_lat: query.origin_lat,
      origin_lng: query.origin_lng,
    };
  }
}
