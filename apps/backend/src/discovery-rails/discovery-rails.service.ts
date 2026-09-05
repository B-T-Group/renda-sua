import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { RequestContext } from '../auth/request-context';

export interface TopInCategoryItem {
  id: string;
  item_id: string;
  item_name: string;
  item_description: string;
  selling_price: number;
  currency: string;
  category_name: string;
  subcategory_name: string;
  business_location_id: string;
  location_name: string;
  business_id: string;
  business_name: string;
  avg_rating: number | null;
  rating_count: number | null;
  recent_orders_30d: number;
  image_url?: string | null;
  distance_meters?: number | null;
}

export interface DealItem {
  id: string;
  item_id: string;
  item_name: string;
  item_description: string;
  original_price: number;
  discounted_price: number;
  currency: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  deal_end_at: string;
  business_location_id: string;
  location_name: string;
  business_id: string;
  business_name: string;
  category_name: string;
  subcategory_name: string;
  image_url?: string | null;
  distance_meters?: number | null;
}

export interface FeaturedStore {
  business_id: string;
  business_location_id: string;
  location_name: string;
  business_name: string;
  storefront_visible: boolean;
  logo_url?: string | null;
  cover_image_url?: string | null;
  description?: string | null;
  country_code: string;
  state?: string | null;
  city?: string | null;
  total_items: number;
  avg_rating: number | null;
  total_ratings: number | null;
  distance_meters?: number | null;
}

export interface ComplementItem {
  id: string;
  item_id: string;
  item_name: string;
  item_description: string;
  selling_price: number;
  currency: string;
  category_name: string;
  subcategory_name: string;
  business_location_id: string;
  image_url?: string | null;
}

interface RailQueryOptions {
  country_code?: string;
  state?: string;
  origin_lat?: number;
  origin_lng?: number;
  limit?: number;
}

@Injectable()
export class DiscoveryRailsService {
  private readonly logger = new Logger(DiscoveryRailsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  /**
   * Get top-rated items in a specific category, scoped by country/fulfillment.
   */
  async getTopInCategory(
    categoryName: string,
    options: RailQueryOptions,
    ctx?: RequestContext
  ): Promise<TopInCategoryItem[]> {
    const limit = Math.min(options.limit ?? 10, 20);
    const { country_code, state, origin_lat, origin_lng } = options;

    // Resolve user address for distance if authenticated
    let userLat: number | undefined;
    let userLng: number | undefined;
    if (ctx) {
      try {
        const userId = this.hasuraUserService.getUserId(ctx);
        const primaryAddress = await this.getUserPrimaryAddress(userId);
        if (primaryAddress?.latitude && primaryAddress?.longitude) {
          userLat = primaryAddress.latitude;
          userLng = primaryAddress.longitude;
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to resolve user address for top-in-category: ${error.message}`
        );
      }
    }

    // Fallback to origin coords if no user address
    const finalLat = userLat ?? origin_lat;
    const finalLng = userLng ?? origin_lng;

    const query = `
      query GetTopInCategory(
        $categoryName: String!
        $countryCode: String
        $state: String
        $limit: Int!
      ) {
        business_inventory(
          where: {
            is_active: { _eq: true }
            computed_available_quantity: { _gt: 0 }
            item: {
              is_active: { _eq: true }
              item_sub_category: {
                item_category: { name: { _ilike: $categoryName } }
              }
            }
            business_location: {
              is_active: { _eq: true }
              storefront_visible: { _eq: true }
              country_code: { ${country_code ? '_eq: $countryCode' : '_is_null: false'} }
              ${state ? 'state: { _eq: $state }' : ''}
            }
          }
          limit: $limit
        ) {
          id
          selling_price
          business_location_id
          item_id
          item {
            id
            name
            description
            currency
            item_sub_category {
              name
              item_category {
                name
              }
            }
            item_images(limit: 1, order_by: { created_at: asc }) {
              image_url
            }
          }
          business_location {
            id
            location_name
            business {
              id
              business_name
            }
            latitude
            longitude
          }
        }
      }
    `;

    const variables: Record<string, unknown> = {
      categoryName,
      limit,
    };
    if (country_code) variables.countryCode = country_code;
    if (state) variables.state = state;

    const result = await this.hasuraSystemService.executeQuery(query, variables);
    const listings = (result.business_inventory || []) as Array<{
      id: string;
      selling_price: number;
      business_location_id: string;
      item_id: string;
      item: {
        id: string;
        name: string;
        description: string;
        currency: string;
        item_sub_category: {
          name: string;
          item_category: { name: string };
        };
        item_images: Array<{ image_url: string }>;
      };
      business_location: {
        id: string;
        location_name: string;
        business: { id: string; business_name: string };
        latitude?: number | null;
        longitude?: number | null;
      };
    }>;

    // Enrich with ratings and recent orders
    const enriched = await this.enrichWithRatingsAndOrders(listings);

    // Sort by relevance: avg_rating desc, recent_orders_30d desc
    enriched.sort((a, b) => {
      const ratingDiff = (b.avg_rating || 0) - (a.avg_rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return b.recent_orders_30d - a.recent_orders_30d;
    });

    // Add distance if coords available
    const withDistance = await this.addDistanceToItems(
      enriched,
      finalLat,
      finalLng
    );

    return withDistance.slice(0, limit);
  }

  /**
   * Get active deals near the user or in their fulfillment scope.
   */
  async getDealsNearYou(
    options: RailQueryOptions,
    ctx?: RequestContext
  ): Promise<DealItem[]> {
    const limit = Math.min(options.limit ?? 10, 20);
    const { country_code, state, origin_lat, origin_lng } = options;

    let userLat: number | undefined;
    let userLng: number | undefined;
    if (ctx) {
      try {
        const userId = this.hasuraUserService.getUserId(ctx);
        const primaryAddress = await this.getUserPrimaryAddress(userId);
        if (primaryAddress?.latitude && primaryAddress?.longitude) {
          userLat = primaryAddress.latitude;
          userLng = primaryAddress.longitude;
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to resolve user address for deals: ${error.message}`
        );
      }
    }

    const finalLat = userLat ?? origin_lat;
    const finalLng = userLng ?? origin_lng;

    const now = new Date().toISOString();
    const query = `
      query GetActiveDeals(
        $now: timestamptz!
        $countryCode: String
        $state: String
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
              business_location: {
                is_active: { _eq: true }
                storefront_visible: { _eq: true }
                country_code: { ${country_code ? '_eq: $countryCode' : '_is_null: false'} }
                ${state ? 'state: { _eq: $state }' : ''}
              }
            }
          }
          limit: $limit
          order_by: { start_at: desc }
        ) {
          id
          discount_type
          discount_value
          end_at
          business_inventory {
            id
            selling_price
            business_location_id
            item_id
            item {
              id
              name
              description
              price
              currency
              item_sub_category {
                name
                item_category { name }
              }
              item_images(limit: 1, order_by: { created_at: asc }) {
                image_url
              }
            }
            business_location {
              id
              location_name
              business {
                id
                business_name
              }
              latitude
              longitude
            }
          }
        }
      }
    `;

    const variables: Record<string, unknown> = {
      now,
      limit,
    };
    if (country_code) variables.countryCode = country_code;
    if (state) variables.state = state;

    const result = await this.hasuraSystemService.executeQuery(query, variables);
    const deals = (result.item_deals || []) as Array<{
      id: string;
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      end_at: string;
      business_inventory: {
        id: string;
        selling_price: number;
        business_location_id: string;
        item_id: string;
        item: {
          id: string;
          name: string;
          description: string;
          price: number;
          currency: string;
          item_sub_category: {
            name: string;
            item_category: { name: string };
          };
          item_images: Array<{ image_url: string }>;
        };
        business_location: {
          id: string;
          location_name: string;
          business: { id: string; business_name: string };
          latitude?: number | null;
          longitude?: number | null;
        };
      };
    }>;

    const dealItems: DealItem[] = deals.map((deal) => {
      const inv = deal.business_inventory;
      const original = inv.selling_price;
      let discounted = original;
      if (deal.discount_type === 'percentage') {
        discounted = original * (1 - deal.discount_value / 100);
      } else {
        discounted = Math.max(0, original - deal.discount_value);
      }

      return {
        id: inv.id,
        item_id: inv.item_id,
        item_name: inv.item.name,
        item_description: inv.item.description,
        original_price: original,
        discounted_price: discounted,
        currency: inv.item.currency,
        discount_type: deal.discount_type,
        discount_value: deal.discount_value,
        deal_end_at: deal.end_at,
        business_location_id: inv.business_location_id,
        location_name: inv.business_location.location_name,
        business_id: inv.business_location.business.id,
        business_name: inv.business_location.business.business_name,
        category_name: inv.item.item_sub_category.item_category.name,
        subcategory_name: inv.item.item_sub_category.name,
        image_url: inv.item.item_images[0]?.image_url,
      };
    });

    // Add distance if coords available
    const withDistance = await this.addDistanceToDealItems(
      dealItems,
      finalLat,
      finalLng
    );

    return withDistance;
  }

  /**
   * Get featured stores in the user's fulfillment scope.
   */
  async getFeaturedStores(
    options: RailQueryOptions,
    ctx?: RequestContext
  ): Promise<FeaturedStore[]> {
    const limit = Math.min(options.limit ?? 5, 10);
    const { country_code, state, origin_lat, origin_lng } = options;

    let userLat: number | undefined;
    let userLng: number | undefined;
    if (ctx) {
      try {
        const userId = this.hasuraUserService.getUserId(ctx);
        const primaryAddress = await this.getUserPrimaryAddress(userId);
        if (primaryAddress?.latitude && primaryAddress?.longitude) {
          userLat = primaryAddress.latitude;
          userLng = primaryAddress.longitude;
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to resolve user address for featured stores: ${error.message}`
        );
      }
    }

    const finalLat = userLat ?? origin_lat;
    const finalLng = userLng ?? origin_lng;

    const query = `
      query GetFeaturedStores(
        $countryCode: String
        $state: String
        $limit: Int!
      ) {
        business_locations(
          where: {
            is_active: { _eq: true }
            storefront_visible: { _eq: true }
            country_code: { ${country_code ? '_eq: $countryCode' : '_is_null: false'} }
            ${state ? 'state: { _eq: $state }' : ''}
            business: { is_active: { _eq: true } }
            business_inventory_aggregate: {
              count: { predicate: { _gt: 0 } }
            }
          }
          limit: $limit
          order_by: { created_at: desc }
        ) {
          id
          location_name
          storefront_visible
          logo_url
          cover_image_url
          description
          country_code
          state
          city
          latitude
          longitude
          business {
            id
            business_name
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

    const variables: Record<string, unknown> = {
      limit,
    };
    if (country_code) variables.countryCode = country_code;
    if (state) variables.state = state;

    const result = await this.hasuraSystemService.executeQuery(query, variables);
    const locations = (result.business_locations || []) as Array<{
      id: string;
      location_name: string;
      storefront_visible: boolean;
      logo_url?: string | null;
      cover_image_url?: string | null;
      description?: string | null;
      country_code: string;
      state?: string | null;
      city?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      business: {
        id: string;
        business_name: string;
      };
      business_inventory_aggregate: {
        aggregate: { count: number };
      };
    }>;

    // Enrich with ratings
    const enriched = await this.enrichStoresWithRatings(locations);

    // Add distance if coords available
    const withDistance = await this.addDistanceToStores(
      enriched,
      finalLat,
      finalLng
    );

    return withDistance;
  }

  /**
   * Get bag complement items (items frequently bought together).
   * For v1, we use a simple category-based heuristic.
   */
  async getBagComplements(
    cartItemIds: string[],
    options: RailQueryOptions
  ): Promise<ComplementItem[]> {
    if (!cartItemIds.length) {
      return [];
    }

    const limit = Math.min(options.limit ?? 6, 12);
    const { country_code, state } = options;

    // Get categories of items in cart
    const cartQuery = `
      query GetCartItemCategories($itemIds: [uuid!]!) {
        items(where: { id: { _in: $itemIds } }) {
          id
          item_sub_category {
            item_category_id
          }
        }
      }
    `;

    const cartResult = await this.hasuraSystemService.executeQuery(cartQuery, {
      itemIds: cartItemIds,
    });
    const cartItems = (cartResult.items || []) as Array<{
      id: string;
      item_sub_category: { item_category_id: number };
    }>;

    const categoryIds = [
      ...new Set(cartItems.map((i) => i.item_sub_category.item_category_id)),
    ];

    if (!categoryIds.length) {
      return [];
    }

    // Find items in related categories not in cart
    const complementQuery = `
      query GetComplementItems(
        $categoryIds: [Int!]!
        $excludeItemIds: [uuid!]!
        $countryCode: String
        $state: String
        $limit: Int!
      ) {
        business_inventory(
          where: {
            is_active: { _eq: true }
            computed_available_quantity: { _gt: 0 }
            item_id: { _nin: $excludeItemIds }
            item: {
              is_active: { _eq: true }
              item_sub_category: {
                item_category_id: { _in: $categoryIds }
              }
            }
            business_location: {
              is_active: { _eq: true }
              storefront_visible: { _eq: true }
              country_code: { ${country_code ? '_eq: $countryCode' : '_is_null: false'} }
              ${state ? 'state: { _eq: $state }' : ''}
            }
          }
          limit: $limit
        ) {
          id
          selling_price
          business_location_id
          item_id
          item {
            id
            name
            description
            currency
            item_sub_category {
              name
              item_category { name }
            }
            item_images(limit: 1, order_by: { created_at: asc }) {
              image_url
            }
          }
        }
      }
    `;

    const variables: Record<string, unknown> = {
      categoryIds,
      excludeItemIds: cartItemIds,
      limit,
    };
    if (country_code) variables.countryCode = country_code;
    if (state) variables.state = state;

    const result = await this.hasuraSystemService.executeQuery(
      complementQuery,
      variables
    );
    const listings = (result.business_inventory || []) as Array<{
      id: string;
      selling_price: number;
      business_location_id: string;
      item_id: string;
      item: {
        id: string;
        name: string;
        description: string;
        currency: string;
        item_sub_category: {
          name: string;
          item_category: { name: string };
        };
        item_images: Array<{ image_url: string }>;
      };
    }>;

    return listings.map((inv) => ({
      id: inv.id,
      item_id: inv.item_id,
      item_name: inv.item.name,
      item_description: inv.item.description,
      selling_price: inv.selling_price,
      currency: inv.item.currency,
      category_name: inv.item.item_sub_category.item_category.name,
      subcategory_name: inv.item.item_sub_category.name,
      business_location_id: inv.business_location_id,
      image_url: inv.item.item_images[0]?.image_url,
    }));
  }

  // -------------------------
  // Private helper methods
  // -------------------------

  private async getUserPrimaryAddress(
    userId: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    const query = `
      query GetUserPrimaryAddress($userId: uuid!) {
        users_by_pk(id: $userId) {
          addresses(where: { is_primary: { _eq: true }, status: { _eq: "active" } }, limit: 1) {
            latitude
            longitude
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });

    const addresses = result.users_by_pk?.addresses;
    if (addresses && addresses.length > 0 && addresses[0].latitude && addresses[0].longitude) {
      return {
        latitude: addresses[0].latitude,
        longitude: addresses[0].longitude,
      };
    }

    return null;
  }

  private async enrichWithRatingsAndOrders(
    listings: Array<{
      id: string;
      selling_price: number;
      business_location_id: string;
      item_id: string;
      item: {
        id: string;
        name: string;
        description: string;
        currency: string;
        item_sub_category: {
          name: string;
          item_category: { name: string };
        };
        item_images: Array<{ image_url: string }>;
      };
      business_location: {
        id: string;
        location_name: string;
        business: { id: string; business_name: string };
        latitude?: number | null;
        longitude?: number | null;
      };
    }>
  ): Promise<TopInCategoryItem[]> {
    const itemIds = listings.map((l) => l.item_id);
    if (!itemIds.length) return [];

    const statsQuery = `
      query GetItemStats($itemIds: [uuid!]!) {
        rating_aggregates(
          where: {
            rated_entity_type: { _eq: "item" }
            rated_entity_id: { _in: $itemIds }
          }
        ) {
          entity_id: rated_entity_id
          average_rating
          total_ratings
        }
        order_items_aggregate(
          where: {
            item_id: { _in: $itemIds }
            order: {
              created_at: { _gte: "2026-08-06T00:00:00Z" }
            }
          }
        ) {
          nodes {
            item_id
          }
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

    const orderNodes = (statsResult.order_items_aggregate?.nodes ||
      []) as Array<{
      item_id: string;
    }>;

    const orderCounts: Record<string, number> = {};
    for (const node of orderNodes) {
      orderCounts[node.item_id] = (orderCounts[node.item_id] || 0) + 1;
    }

    const ratingMap = new Map(ratings.map((r) => [r.entity_id, r]));

    return listings.map((inv) => {
      const rating = ratingMap.get(inv.item_id);
      const orderCount = orderCounts[inv.item_id] || 0;

      return {
        id: inv.id,
        item_id: inv.item_id,
        item_name: inv.item.name,
        item_description: inv.item.description,
        selling_price: inv.selling_price,
        currency: inv.item.currency,
        category_name: inv.item.item_sub_category.item_category.name,
        subcategory_name: inv.item.item_sub_category.name,
        business_location_id: inv.business_location_id,
        location_name: inv.business_location.location_name,
        business_id: inv.business_location.business.id,
        business_name: inv.business_location.business.business_name,
        avg_rating: rating?.average_rating ?? null,
        rating_count: rating?.total_ratings ?? null,
        recent_orders_30d: orderCount,
        image_url: inv.item.item_images[0]?.image_url,
      };
    });
  }

  private async enrichStoresWithRatings(
    locations: Array<{
      id: string;
      location_name: string;
      storefront_visible: boolean;
      logo_url?: string | null;
      cover_image_url?: string | null;
      description?: string | null;
      country_code: string;
      state?: string | null;
      city?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      business: {
        id: string;
        business_name: string;
      };
      business_inventory_aggregate: {
        aggregate: { count: number };
      };
    }>
  ): Promise<
    Array<{
      business_id: string;
      business_location_id: string;
      location_name: string;
      business_name: string;
      storefront_visible: boolean;
      logo_url?: string | null;
      cover_image_url?: string | null;
      description?: string | null;
      country_code: string;
      state?: string | null;
      city?: string | null;
      total_items: number;
      avg_rating: number | null;
      total_ratings: number | null;
      latitude?: number | null;
      longitude?: number | null;
    }>
  > {
    const businessIds = locations.map((l) => l.business.id);
    if (!businessIds.length) return [];

    const ratingsQuery = `
      query GetBusinessRatings($businessIds: [uuid!]!) {
        rating_aggregates(
          where: {
            rated_entity_type: { _eq: "business" }
            rated_entity_id: { _in: $businessIds }
          }
        ) {
          entity_id: rated_entity_id
          average_rating
          total_ratings
        }
      }
    `;

    const ratingsResult = await this.hasuraSystemService.executeQuery(
      ratingsQuery,
      { businessIds }
    );
    const ratings = (ratingsResult.rating_aggregates || []) as Array<{
      entity_id: string;
      average_rating: number;
      total_ratings: number;
    }>;

    const ratingMap = new Map(ratings.map((r) => [r.entity_id, r]));

    return locations.map((loc) => {
      const rating = ratingMap.get(loc.business.id);
      return {
        business_id: loc.business.id,
        business_location_id: loc.id,
        location_name: loc.location_name,
        business_name: loc.business.business_name,
        storefront_visible: loc.storefront_visible,
        logo_url: loc.logo_url,
        cover_image_url: loc.cover_image_url,
        description: loc.description,
        country_code: loc.country_code,
        state: loc.state,
        city: loc.city,
        total_items: loc.business_inventory_aggregate.aggregate.count,
        avg_rating: rating?.average_rating ?? null,
        total_ratings: rating?.total_ratings ?? null,
        latitude: loc.latitude,
        longitude: loc.longitude,
      };
    });
  }

  private async addDistanceToItems(
    items: TopInCategoryItem[],
    lat?: number,
    lng?: number
  ): Promise<TopInCategoryItem[]> {
    if (!lat || !lng || !items.length) {
      return items;
    }

    // Items already have lat/lng from business_location join in query
    // We need to fetch locations again for distance calculation or store them
    // For simplicity, we'll do a batch distance calculation
    // This is a simplified version - in production, you'd optimize this

    return items.map((item) => ({
      ...item,
      distance_meters: undefined, // Would calculate here in real implementation
    }));
  }

  private async addDistanceToDealItems(
    items: DealItem[],
    lat?: number,
    lng?: number
  ): Promise<DealItem[]> {
    if (!lat || !lng || !items.length) {
      return items;
    }

    return items.map((item) => ({
      ...item,
      distance_meters: undefined, // Would calculate here in real implementation
    }));
  }

  private async addDistanceToStores(
    stores: FeaturedStore[],
    lat?: number,
    lng?: number
  ): Promise<FeaturedStore[]> {
    if (!lat || !lng || !stores.length) {
      return stores;
    }

    return stores.map((store) => ({
      ...store,
      distance_meters: undefined, // Would calculate here in real implementation
    }));
  }
}
