import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { InventoryItem } from '../inventory-items/inventory-items.service';
import {
  CollectionsService,
  type CollectionSummary,
} from '../collections/collections.service';
import type { TopInventoryStoreRow } from '../inventory-items/inventory-items.service';

export interface TopInCategoryResponse {
  category_name: string;
  items: InventoryItem[];
}

export interface DealsResponse {
  items: InventoryItem[];
}

export interface EssentialsResponse {
  collections: CollectionSummary[];
}

export interface FeaturedStoreResponse {
  stores: TopInventoryStoreRow[];
}

export interface BagComplementsResponse {
  items: Array<InventoryItem & { reason_label?: string }>;
}

interface StopQueryOptions {
  country_code?: string;
  state?: string;
  origin_lat?: number;
  origin_lng?: number;
  limit?: number;
}

interface TopInCategoryOptions extends StopQueryOptions {
  category?: string;
  subcategory?: string;
}

interface BagComplementsOptions extends StopQueryOptions {
  inventory_item_ids: string[];
}

interface FeaturedLocationRow {
  id: string;
  name: string;
  logo_url?: string | null;
  business: {
    id: string;
    name: string;
    is_verified?: boolean | null;
    can_accept_orders?: boolean | null;
    is_storefront_visible?: boolean | null;
  };
  address?: { city?: string | null } | null;
  business_inventory_aggregate: {
    aggregate: { count: number };
  };
}

const INVENTORY_ITEM_SELECTION = `
  id
  selling_price
  computed_available_quantity
  is_active
  business_location_id
  item_id
  promotion
  variant_price_overrides {
    id
    item_variant_id
    selling_price
  }
  item {
    id
    name
    description
    price
    currency
    weight
    weight_unit
    dimensions
    item_sub_category_id
    is_active
    brand {
      id
      name
    }
    sku
    item_sub_category {
      id
      name
      item_category {
        id
        name
      }
    }
    item_images(order_by: { created_at: asc }, limit: 5) {
      id
      image_url
    }
    item_variants(
      where: { is_active: { _eq: true } }
      order_by: { sort_order: asc }
    ) {
      id
      name
      sku
      price
      is_active
    }
  }
  business_location {
    id
    name
    business {
      id
      name
    }
  }
`;

@Injectable()
export class CatalogStopsService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly collectionsService: CollectionsService
  ) {}

  /**
   * Get top items in category (reuses inventory item shape from GET /inventory-items).
   */
  async getTopInCategory(
    options: TopInCategoryOptions
  ): Promise<TopInCategoryResponse> {
    const limit = Math.min(options.limit ?? 8, 20);
    const { category, subcategory } = options;
    const itemWhere = this.buildItemWhere(category, subcategory);
    const locationWhere = this.buildLocationWhere(options);

    const query = `
      query GetTopInCategory(
        $itemWhere: items_bool_exp!
        $locationWhere: business_locations_bool_exp!
        $limit: Int!
      ) {
        business_inventory(
          where: {
            is_active: { _eq: true }
            computed_available_quantity: { _gt: 0 }
            item: $itemWhere
            business_location: $locationWhere
          }
          limit: $limit
        ) {
          ${INVENTORY_ITEM_SELECTION}
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      limit,
      itemWhere,
      locationWhere,
    });
    const listings = (result.business_inventory || []) as InventoryItem[];
    const categoryName = this.resolveCategoryName(
      listings,
      category,
      subcategory
    );
    const enriched = await this.enrichWithRatings(listings);
    this.sortByRatingThenViews(enriched);

    return {
      category_name: categoryName,
      items: enriched.slice(0, limit),
    };
  }

  /**
   * Get deals (only deal-active rows, same inventory item shape).
   */
  async getDeals(options: StopQueryOptions): Promise<DealsResponse> {
    const limit = Math.min(options.limit ?? 8, 20);
    const now = new Date().toISOString();
    const locationWhere = this.buildLocationWhere(options);

    const query = `
      query GetActiveDeals(
        $now: timestamptz!
        $locationWhere: business_locations_bool_exp!
        $limit: Int!
      ) {
        item_deals(
          where: {
            is_active: { _eq: true }
            start_at: { _lte: $now }
            end_at: { _gte: $now }
            business_inventory: {
              is_active: { _eq: true }
              computed_available_quantity: { _gt: 0 }
              item: { is_active: { _eq: true } }
              business_location: $locationWhere
            }
          }
          limit: $limit
          order_by: { start_at: desc }
        ) {
          id
          discount_type
          discount_value
          start_at
          end_at
          business_inventory {
            ${INVENTORY_ITEM_SELECTION}
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      now,
      limit,
      locationWhere,
    });
    const deals = (result.item_deals || []) as Array<{
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      end_at: string;
      business_inventory: InventoryItem;
    }>;

    return { items: deals.map((deal) => this.mapDealItem(deal)) };
  }

  /**
   * Featured/essentials collections with in-area listings.
   * Reuses CollectionsService (preview images + min 4 listings filter).
   */
  async getEssentials(options: StopQueryOptions): Promise<EssentialsResponse> {
    const limit = Math.min(options.limit ?? 8, 20);
    const collections = await this.collectionsService.listCollections({
      featured: true,
      country_code: options.country_code,
      state: options.state,
      origin_lat: options.origin_lat,
      origin_lng: options.origin_lng,
    });
    return { collections: collections.slice(0, limit) };
  }

  /**
   * Get featured stores (catalog store shape).
   */
  async getFeaturedStore(
    options: StopQueryOptions
  ): Promise<FeaturedStoreResponse> {
    const limit = Math.min(options.limit ?? 1, 5);
    const locationWhere = this.buildLocationWhere(options, {
      business_inventory_aggregate: {
        count: { predicate: { _gt: 0 } },
      },
    });

    const query = `
      query GetFeaturedStores(
        $locationWhere: business_locations_bool_exp!
        $limit: Int!
      ) {
        business_locations(
          where: $locationWhere
          limit: $limit
          order_by: { created_at: desc }
        ) {
          id
          name
          logo_url
          business {
            id
            name
            is_verified
            can_accept_orders
            is_storefront_visible
          }
          address {
            city
          }
          business_inventory_aggregate(
            where: {
              is_active: { _eq: true }
              computed_available_quantity: { _gt: 0 }
            }
          ) {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      limit,
      locationWhere,
    });
    const locations = (result.business_locations || []) as FeaturedLocationRow[];
    return { stores: locations.map((loc) => this.mapFeaturedStore(loc)) };
  }

  /**
   * Get bag complements (if weak BE signal, return empty array).
   */
  async getBagComplements(
    options: BagComplementsOptions
  ): Promise<BagComplementsResponse> {
    if (!options.inventory_item_ids.length) {
      return { items: [] };
    }

    const limit = Math.min(options.limit ?? 6, 12);
    const categoryIds = await this.getCartCategoryIds(
      options.inventory_item_ids
    );
    if (!categoryIds.length) {
      return { items: [] };
    }

    const locationWhere = this.buildLocationWhere(options);
    const complementQuery = `
      query GetComplementItems(
        $categoryIds: [Int!]!
        $excludeIds: [uuid!]!
        $locationWhere: business_locations_bool_exp!
        $limit: Int!
      ) {
        business_inventory(
          where: {
            is_active: { _eq: true }
            computed_available_quantity: { _gt: 0 }
            id: { _nin: $excludeIds }
            item: {
              is_active: { _eq: true }
              item_sub_category: {
                item_category_id: { _in: $categoryIds }
              }
            }
            business_location: $locationWhere
          }
          limit: $limit
        ) {
          ${INVENTORY_ITEM_SELECTION}
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(
      complementQuery,
      {
        categoryIds,
        excludeIds: options.inventory_item_ids,
        locationWhere,
        limit,
      }
    );
    const listings = (result.business_inventory || []) as InventoryItem[];
    const items = listings.map((item) => ({
      ...item,
      reason_label: 'Popular in same category',
    }));

    return { items };
  }

  private buildItemWhere(
    category?: string,
    subcategory?: string
  ): Record<string, unknown> {
    const itemWhere: Record<string, unknown> = {
      is_active: { _eq: true },
    };
    if (subcategory?.trim()) {
      itemWhere.item_sub_category = { name: { _eq: subcategory.trim() } };
    } else if (category?.trim()) {
      itemWhere.item_sub_category = {
        item_category: { name: { _ilike: `%${category.trim()}%` } },
      };
    }
    return itemWhere;
  }

  /**
   * Country/state live on addresses, storefront visibility on businesses.
   * business_locations has neither country_code nor storefront_visible.
   */
  private buildLocationWhere(
    options: StopQueryOptions,
    extras: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const country = options.country_code?.trim();
    const state = options.state?.trim();
    const address: Record<string, unknown> = {
      country: country ? { _eq: country } : { _is_null: false },
    };
    if (state) {
      address.state = { _eq: state };
    }
    return {
      is_active: { _eq: true },
      business: { is_storefront_visible: { _eq: true } },
      address,
      ...extras,
    };
  }

  private resolveCategoryName(
    listings: InventoryItem[],
    category?: string,
    subcategory?: string
  ): string {
    return (
      listings[0]?.item?.item_sub_category?.item_category?.name ||
      category ||
      subcategory ||
      'All'
    );
  }

  private sortByRatingThenViews(items: InventoryItem[]): void {
    items.sort((a, b) => {
      const ratingDiff = (b.avg_rating || 0) - (a.avg_rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.viewsCount || 0) - (a.viewsCount || 0);
    });
  }

  private mapDealItem(deal: {
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    end_at: string;
    business_inventory: InventoryItem;
  }): InventoryItem {
    const original = deal.business_inventory.selling_price;
    const discounted =
      deal.discount_type === 'percentage'
        ? original * (1 - deal.discount_value / 100)
        : Math.max(0, original - deal.discount_value);
    return {
      ...deal.business_inventory,
      hasActiveDeal: true,
      original_price: original,
      discounted_price: discounted,
      deal_discount_type: deal.discount_type,
      deal_discount_value: deal.discount_value,
      deal_end_at: deal.end_at,
    };
  }

  private mapFeaturedStore(loc: FeaturedLocationRow): TopInventoryStoreRow {
    return {
      business_id: loc.business.id,
      business_location_id: loc.id,
      name: loc.name,
      city: loc.address?.city || null,
      logo_url: loc.logo_url || null,
      item_count: loc.business_inventory_aggregate.aggregate.count,
      is_verified: loc.business.is_verified === true,
      can_accept_orders: loc.business.can_accept_orders === true,
      is_storefront_visible: loc.business.is_storefront_visible === true,
    };
  }

  private async getCartCategoryIds(inventoryItemIds: string[]): Promise<number[]> {
    const cartQuery = `
      query GetCartItemCategories($itemIds: [uuid!]!) {
        business_inventory(where: { id: { _in: $itemIds } }) {
          item {
            item_sub_category {
              item_category_id
            }
          }
        }
      }
    `;
    const cartResult = await this.hasuraSystemService.executeQuery(cartQuery, {
      itemIds: inventoryItemIds,
    });
    const cartItems = (cartResult.business_inventory || []) as Array<{
      item?: { item_sub_category?: { item_category_id?: number } | null } | null;
    }>;
    return [
      ...new Set(
        cartItems
          .map((row) => row.item?.item_sub_category?.item_category_id)
          .filter((id): id is number => typeof id === 'number')
      ),
    ];
  }

  private async enrichWithRatings(
    listings: InventoryItem[]
  ): Promise<InventoryItem[]> {
    const itemIds = listings.map((l) => l.item_id);
    if (!itemIds.length) return [];

    const statsQuery = `
      query GetItemStats($itemIds: [uuid!]!) {
        rating_aggregates(
          where: {
            entity_type: { _eq: "item" }
            entity_id: { _in: $itemIds }
          }
        ) {
          entity_id
          average_rating
          total_ratings
        }
      }
    `;

    const statsResult = await this.hasuraSystemService.executeQuery(statsQuery, {
      itemIds,
    });
    const ratings = (statsResult.rating_aggregates || []) as Array<{
      entity_id: string;
      average_rating: number;
      total_ratings: number;
    }>;
    const ratingMap = new Map(ratings.map((r) => [r.entity_id, r]));

    return listings.map((inv) => {
      const rating = ratingMap.get(inv.item_id);
      return {
        ...inv,
        avg_rating: rating?.average_rating ?? null,
        rating_count: rating?.total_ratings ?? null,
      };
    });
  }
}
