import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { RequestContext } from '../auth/request-context';
import type { InventoryItem } from '../inventory-items/inventory-items.service';
import type { CollectionSummary } from '../collections/collections.service';
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
  address?: { city?: string | null } | null;
  business: {
    id: string;
    name: string;
    is_verified?: boolean;
    can_accept_orders?: boolean;
    is_storefront_visible?: boolean;
  };
  business_inventory_aggregate: {
    aggregate: { count: number };
  };
}

@Injectable()
export class CatalogStopsService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  private geoVarDecls(countryCode?: string, state?: string): string {
    return [
      countryCode ? '$countryCode: String' : null,
      state ? '$state: String' : null,
    ]
      .filter((decl): decl is string => Boolean(decl))
      .join('\n        ');
  }

  private geoVariables(
    countryCode?: string,
    state?: string
  ): Record<string, string> {
    const variables: Record<string, string> = {};
    if (countryCode) variables.countryCode = countryCode;
    if (state) variables.state = state;
    return variables;
  }

  /** Country/state live on addresses, not business_locations. */
  private locationScopeFragment(countryCode?: string, state?: string): string {
    const country = countryCode
      ? 'country: { _eq: $countryCode }'
      : 'country: { _is_null: false }';
    const stateFilter = state ? '\n                state: { _eq: $state }' : '';
    return `
              is_active: { _eq: true }
              address: {
                ${country}${stateFilter}
              }
              business: { is_storefront_visible: { _eq: true } }`;
  }

  /**
   * Get top items in category (reuses inventory item shape from GET /inventory-items).
   */
  async getTopInCategory(
    options: TopInCategoryOptions,
    ctx?: RequestContext
  ): Promise<TopInCategoryResponse> {
    const limit = Math.min(options.limit ?? 8, 20);
    const { country_code, state, category, subcategory } = options;

    // Note: User address resolution and distance calculation omitted for v1 (simplified)
    // Future: resolve user primary address and calculate distance

    // Build where clause for category/subcategory
    const itemWhere: Record<string, unknown> = {
      is_active: { _eq: true },
    };

    if (subcategory?.trim()) {
      itemWhere.item_sub_category = { name: { _eq: subcategory.trim() } };
    } else if (category?.trim()) {
      // When only category is specified, match on category name
      itemWhere.item_sub_category = {
        item_category: { name: { _ilike: `%${category.trim()}%` } },
      };
    }

    const query = `
      query GetTopInCategory(
        ${this.geoVarDecls(country_code, state)}
        $itemWhere: items_bool_exp!
        $limit: Int!
      ) {
        business_inventory(
          where: {
            is_active: { _eq: true }
            computed_available_quantity: { _gt: 0 }
            item: $itemWhere
            business_location: {${this.locationScopeFragment(country_code, state)}
            }
          }
          limit: $limit
        ) {
          id
          selling_price
          computed_available_quantity
          is_active
          business_location_id
          item_id
          promotion
          variant_price_overrides
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
            brand
            condition
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
            item_variants {
              id
              variant_name
              variant_type
              additional_price
              is_available
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
        }
      }
    `;

    const variables: Record<string, unknown> = {
      limit,
      itemWhere,
      ...this.geoVariables(country_code, state),
    };

    const result = await this.hasuraSystemService.executeQuery(query, variables);
    const listings = (result.business_inventory || []) as InventoryItem[];

    // Get category name from first item or use provided category
    const categoryName = 
      listings[0]?.item?.item_sub_category?.item_category?.name ||
      category ||
      subcategory ||
      'All';

    // Enrich with ratings and sort by relevance/top_rated
    const enriched = await this.enrichWithRatings(listings);
    enriched.sort((a, b) => {
      const ratingDiff = (b.avg_rating || 0) - (a.avg_rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.viewsCount || 0) - (a.viewsCount || 0);
    });

    return {
      category_name: categoryName,
      items: enriched.slice(0, limit),
    };
  }

  /**
   * Get deals (only deal-active rows, same inventory item shape).
   */
  async getDeals(
    options: StopQueryOptions,
    ctx?: RequestContext
  ): Promise<DealsResponse> {
    const limit = Math.min(options.limit ?? 8, 20);
    const { country_code, state } = options;

    const now = new Date().toISOString();
    const query = `
      query GetActiveDeals(
        $now: timestamptz!
        ${this.geoVarDecls(country_code, state)}
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
              business_location: {${this.locationScopeFragment(country_code, state)}
              }
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
            id
            selling_price
            computed_available_quantity
            is_active
            business_location_id
            item_id
            promotion
            variant_price_overrides
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
              brand
              condition
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
              item_variants {
                id
                variant_name
                variant_type
                additional_price
                is_available
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
          }
        }
      }
    `;

    const variables: Record<string, unknown> = {
      now,
      limit,
      ...this.geoVariables(country_code, state),
    };

    const result = await this.hasuraSystemService.executeQuery(query, variables);
    const deals = (result.item_deals || []) as Array<{
      id: string;
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      start_at: string;
      end_at: string;
      business_inventory: InventoryItem;
    }>;

    // Enrich inventory items with deal info
    const items: InventoryItem[] = deals.map((deal) => {
      const inv = deal.business_inventory;
      const original = inv.selling_price;
      let discounted = original;
      if (deal.discount_type === 'percentage') {
        discounted = original * (1 - deal.discount_value / 100);
      } else {
        discounted = Math.max(0, original - deal.discount_value);
      }

      return {
        ...inv,
        hasActiveDeal: true,
        original_price: original,
        discounted_price: discounted,
        deal_discount_type: deal.discount_type,
        deal_discount_value: deal.discount_value,
        deal_end_at: deal.end_at,
      };
    });

    return { items };
  }

  /**
   * Get essentials/featured collections.
   */
  async getEssentials(
    options: StopQueryOptions
  ): Promise<EssentialsResponse> {
    const limit = Math.min(options.limit ?? 8, 20);

    const query = `
      query GetFeaturedCollections {
        collections(
          where: { is_featured: { _eq: true } }
          order_by: { sort_order: asc }
          limit: ${limit}
        ) {
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

    const result = await this.hasuraSystemService.executeQuery(query, {});
    const collections = (result.collections || []) as Array<{
      id: string;
      slug: string;
      name_en: string;
      name_fr: string | null;
      description_en: string | null;
      description_fr: string | null;
      image_url: string | null;
      is_featured: boolean;
      sort_order: number;
    }>;

    // Transform to CollectionSummary shape
    const summaries: CollectionSummary[] = collections.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name_en,
      description: c.description_en,
      image_url: c.image_url,
      preview_image_urls: c.image_url ? [c.image_url] : [],
      is_featured: c.is_featured,
      sort_order: c.sort_order,
      listing_count: 0, // Would need separate query to count
    }));

    return { collections: summaries };
  }

  /**
   * Get featured stores (catalog store shape).
   */
  async getFeaturedStore(
    options: StopQueryOptions,
    ctx?: RequestContext
  ): Promise<FeaturedStoreResponse> {
    const limit = Math.min(options.limit ?? 1, 5);
    const { country_code, state } = options;

    const query = `
      query GetFeaturedStores(
        ${this.geoVarDecls(country_code, state)}
        $limit: Int!
      ) {
        business_locations(
          where: {
            ${this.locationScopeFragment(country_code, state)}
            business_inventory_aggregate: {
              count: { predicate: { _gt: 0 } }
            }
          }
          limit: $limit
          order_by: { created_at: desc }
        ) {
          id
          name
          logo_url
          address {
            city
          }
          business {
            id
            name
            is_verified
            can_accept_orders
            is_storefront_visible
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
      ...this.geoVariables(country_code, state),
    });
    const locations = (result.business_locations || []) as FeaturedLocationRow[];
    return { stores: locations.map((loc) => this.mapFeaturedStore(loc)) };
  }

  private mapFeaturedStore(loc: FeaturedLocationRow): TopInventoryStoreRow {
    return {
      business_id: loc.business.id,
      business_location_id: loc.id,
      name: loc.name,
      city: loc.address?.city ?? null,
      logo_url: loc.logo_url ?? null,
      item_count: loc.business_inventory_aggregate.aggregate.count,
      is_verified: loc.business.is_verified === true,
      can_accept_orders: loc.business.can_accept_orders === true,
      is_storefront_visible: loc.business.is_storefront_visible === true,
    };
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
    const { country_code, state, inventory_item_ids } = options;

    // Get categories of items in cart
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
      itemIds: inventory_item_ids,
    });
    const cartItems = (cartResult.business_inventory || []) as Array<{
      item: {
        item_sub_category: { item_category_id: number };
      };
    }>;

    const categoryIds = [
      ...new Set(cartItems.map((i) => i.item.item_sub_category.item_category_id)),
    ];

    if (!categoryIds.length) {
      return { items: [] };
    }

    // Find items in related categories not in cart
    const complementQuery = `
      query GetComplementItems(
        $categoryIds: [Int!]!
        $excludeIds: [uuid!]!
        ${this.geoVarDecls(country_code, state)}
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
            business_location: {${this.locationScopeFragment(country_code, state)}
            }
          }
          limit: $limit
        ) {
          id
          selling_price
          computed_available_quantity
          is_active
          business_location_id
          item_id
          promotion
          variant_price_overrides
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
            brand
            condition
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
            item_variants {
              id
              variant_name
              variant_type
              additional_price
              is_available
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
        }
      }
    `;

    const variables: Record<string, unknown> = {
      categoryIds,
      excludeIds: inventory_item_ids,
      limit,
      ...this.geoVariables(country_code, state),
    };

    const result = await this.hasuraSystemService.executeQuery(
      complementQuery,
      variables
    );
    const listings = (result.business_inventory || []) as InventoryItem[];

    // Add reason labels (simple category-based for v1)
    const items = listings.map((item) => ({
      ...item,
      reason_label: 'Popular in same category',
    }));

    return { items };
  }

  // -------------------------
  // Private helper methods
  // -------------------------

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
