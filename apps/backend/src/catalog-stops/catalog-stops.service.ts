import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { InventoryItem } from '../inventory-items/inventory-items.service';
import type { CollectionSummary } from '../collections/collections.service';
import type { TopInventoryStoreRow } from '../inventory-items/inventory-items.service';
import {
  GET_ACTIVE_DEALS,
  GET_COMPLEMENT_ITEMS,
  GET_FEATURED_STORES,
  GET_TOP_IN_CATEGORY,
  visibleStoreLocationWhere,
} from './catalog-stops-graphql';

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
    is_verified?: boolean;
    can_accept_orders?: boolean;
    is_storefront_visible?: boolean;
  };
  address?: { city?: string | null } | null;
  business_inventory_aggregate: { aggregate: { count: number } };
}

@Injectable()
export class CatalogStopsService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getTopInCategory(
    options: TopInCategoryOptions
  ): Promise<TopInCategoryResponse> {
    const limit = Math.min(options.limit ?? 8, 20);
    const itemWhere = this.buildItemWhere(options.category, options.subcategory);
    const result = await this.hasuraSystemService.executeQuery(
      GET_TOP_IN_CATEGORY,
      {
        limit,
        itemWhere,
        locationWhere: visibleStoreLocationWhere(
          options.country_code,
          options.state
        ),
      }
    );
    const listings = (result.business_inventory || []) as InventoryItem[];
    const enriched = await this.enrichWithRatings(listings);
    this.sortByRatingThenViews(enriched);
    return {
      category_name: this.resolveCategoryName(
        listings,
        options.category,
        options.subcategory
      ),
      items: enriched.slice(0, limit),
    };
  }

  async getDeals(options: StopQueryOptions): Promise<DealsResponse> {
    const limit = Math.min(options.limit ?? 8, 20);
    const result = await this.hasuraSystemService.executeQuery(GET_ACTIVE_DEALS, {
      now: new Date().toISOString(),
      limit,
      locationWhere: visibleStoreLocationWhere(
        options.country_code,
        options.state
      ),
    });
    const deals = (result.item_deals || []) as Array<{
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      end_at: string;
      business_inventory: InventoryItem;
    }>;
    return { items: deals.map((deal) => this.applyDealPricing(deal)) };
  }

  async getEssentials(options: StopQueryOptions): Promise<EssentialsResponse> {
    const limit = Math.min(options.limit ?? 8, 20);
    const query = `
      query GetFeaturedCollections($limit: Int!) {
        collections(
          where: { is_featured: { _eq: true } }
          order_by: { sort_order: asc }
          limit: $limit
        ) {
          id slug name_en name_fr description_en description_fr
          image_url is_featured sort_order
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, { limit });
    const collections = (result.collections || []) as Array<{
      id: string;
      slug: string;
      name_en: string;
      description_en: string | null;
      image_url: string | null;
      is_featured: boolean;
      sort_order: number;
    }>;
    return { collections: collections.map((c) => this.toCollectionSummary(c)) };
  }

  async getFeaturedStore(
    options: StopQueryOptions
  ): Promise<FeaturedStoreResponse> {
    const limit = Math.min(options.limit ?? 1, 5);
    const where = {
      ...visibleStoreLocationWhere(options.country_code, options.state),
      business_inventory_aggregate: { count: { predicate: { _gt: 0 } } },
    };
    const result = await this.hasuraSystemService.executeQuery(
      GET_FEATURED_STORES,
      { where, limit }
    );
    const locations = (result.business_locations || []) as FeaturedLocationRow[];
    return { stores: locations.map((loc) => this.toStoreRow(loc)) };
  }

  async getBagComplements(
    options: BagComplementsOptions
  ): Promise<BagComplementsResponse> {
    if (!options.inventory_item_ids.length) {
      return { items: [] };
    }
    const categoryIds = await this.cartCategoryIds(options.inventory_item_ids);
    if (!categoryIds.length) {
      return { items: [] };
    }
    const limit = Math.min(options.limit ?? 6, 12);
    const result = await this.hasuraSystemService.executeQuery(
      GET_COMPLEMENT_ITEMS,
      {
        categoryIds,
        excludeIds: options.inventory_item_ids,
        locationWhere: visibleStoreLocationWhere(
          options.country_code,
          options.state
        ),
        limit,
      }
    );
    const listings = (result.business_inventory || []) as InventoryItem[];
    return {
      items: listings.map((item) => ({
        ...item,
        reason_label: 'Popular in same category',
      })),
    };
  }

  private buildItemWhere(
    category?: string,
    subcategory?: string
  ): Record<string, unknown> {
    const itemWhere: Record<string, unknown> = { is_active: { _eq: true } };
    if (subcategory?.trim()) {
      itemWhere.item_sub_category = { name: { _eq: subcategory.trim() } };
    } else if (category?.trim()) {
      itemWhere.item_sub_category = {
        item_category: { name: { _ilike: `%${category.trim()}%` } },
      };
    }
    return itemWhere;
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

  private applyDealPricing(deal: {
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

  private toCollectionSummary(row: {
    id: string;
    slug: string;
    name_en: string;
    description_en: string | null;
    image_url: string | null;
    is_featured: boolean;
    sort_order: number;
  }): CollectionSummary {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name_en,
      description: row.description_en,
      image_url: row.image_url,
      preview_image_urls: row.image_url ? [row.image_url] : [],
      is_featured: row.is_featured,
      sort_order: row.sort_order,
      listing_count: 0,
    };
  }

  private toStoreRow(loc: FeaturedLocationRow): TopInventoryStoreRow {
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

  private async cartCategoryIds(inventoryItemIds: string[]): Promise<number[]> {
    const cartQuery = `
      query GetCartItemCategories($itemIds: [uuid!]!) {
        business_inventory(where: { id: { _in: $itemIds } }) {
          item { item_sub_category { item_category_id } }
        }
      }
    `;
    const cartResult = await this.hasuraSystemService.executeQuery(cartQuery, {
      itemIds: inventoryItemIds,
    });
    const cartItems = (cartResult.business_inventory || []) as Array<{
      item?: { item_sub_category?: { item_category_id?: number } };
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
    const itemIds = listings.map((row) => row.item_id);
    if (!itemIds.length) return [];
    const statsQuery = `
      query GetItemStats($itemIds: [uuid!]!) {
        rating_aggregates(
          where: { entity_type: { _eq: "item" }, entity_id: { _in: $itemIds } }
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
    const ratingMap = new Map(ratings.map((row) => [row.entity_id, row]));
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
