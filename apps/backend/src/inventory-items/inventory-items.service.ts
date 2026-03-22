import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressesService } from '../addresses/addresses.service';
import { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  ItemImagesMergeService,
  type ItemImageShape,
} from './item-images-merge.service';

export type InventorySortMode =
  | 'relevance'
  | 'fastest'
  | 'cheapest'
  | 'top_rated'
  | 'deals';

export interface InventoryItem {
  id: string;
  business_location_id: string;
  item_id: string;
  computed_available_quantity: number;
  selling_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  viewsCount?: number;
  hasActiveDeal?: boolean;
  original_price?: number;
  discounted_price?: number;
  deal_end_at?: string;
  distance_text?: string;
  duration_text?: string;
  distance_value?: number;
  avg_rating?: number | null;
  rating_count?: number | null;
    item: {
      id: string;
      name: string;
      description: string;
      price: number;
      currency: string;
      weight: number;
      weight_unit: string;
      dimensions?: string | null;
      item_sub_category_id: number;
    sku: string;
    brand: {
      id: string;
      name: string;
    };
    model: string;
    color: string;
    is_fragile: boolean;
    is_perishable: boolean;
    requires_special_handling: boolean;
    max_delivery_distance: number;
    estimated_delivery_time: number;
    min_order_quantity: number;
    max_order_quantity: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    item_sub_category: {
      id: number;
      name: string;
      item_category: {
        id: number;
        name: string;
      };
    };
    item_images: Array<{
      id: string;
      image_url: string;
      image_type: string;
      alt_text?: string;
      caption?: string;
      display_order: number;
    }>;
    tags?: Array<{ id: string; name: string }>;
  };
  business_location: {
    id: string;
    business_id: string;
    name: string;
    location_type: string;
    is_primary: boolean;
    business: {
      id: string;
      name: string;
      is_verified: boolean;
    };
    address: {
      id: string;
      address_line_1: string;
      address_line_2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

export interface GetInventoryItemsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  is_active?: boolean;
  country_code?: string;
  state?: string;
  sort?: InventorySortMode;
  include_unavailable?: boolean;
}

export interface PaginatedInventoryItems {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const INVENTORY_DISTANCE_CACHE_TTL = 7776000; // 3 months in seconds

@Injectable()
export class InventoryItemsService {
  private readonly logger = new Logger(InventoryItemsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly addressesService: AddressesService,
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly configService: ConfigService,
    private readonly itemImagesMergeService: ItemImagesMergeService
  ) {}

  /**
   * Get paginated inventory items with optional filters.
   * When a valid JWT is present, uses the logged-in user's primary address for country_code/state.
   * Otherwise uses query params (e.g. from anonymous users).
   */
  async getInventoryItems(
    query: GetInventoryItemsQuery = {}
  ): Promise<PaginatedInventoryItems> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      brand,
      min_price,
      max_price,
      currency,
      is_active = true,
      country_code: queryCountryCode,
      state: queryState,
      sort = 'relevance',
      include_unavailable = false,
    } = query;

    // Resolve country_code and state: prefer logged-in user's address when JWT present
    let country_code = queryCountryCode;
    let state = queryState;
    let clientId: string | null = null;
    try {
      const user = await this.hasuraUserService.getUser();
      clientId = user?.client?.id ?? null;
      const addresses = user.addresses;
      if (addresses?.length) {
        const primary =
          addresses.find((a) => a.is_primary === true) ?? addresses[0];
        if (primary?.country) {
          country_code = primary.country;
          state = primary.state ?? state;
        }
      }
    } catch {
      // Anonymous or invalid token: use query params as-is
    }

    // Build where conditions
    const whereConditions: any[] = [];

    // Only show active items by default
    whereConditions.push({ is_active: { _eq: is_active } });

    // Only show items from verified businesses
    whereConditions.push({
      business_location: {
        business: { is_verified: { _eq: true } },
      },
    });

    // Hide unavailable (zero stock) unless explicitly requested
    if (!include_unavailable) {
      whereConditions.push({ computed_available_quantity: { _gt: 0 } });
    }

    // Search filter
    if (search) {
      whereConditions.push({
        _or: [
          { item: { name: { _ilike: `%${search}%` } } },
          { item: { description: { _ilike: `%${search}%` } } },
          { item: { sku: { _ilike: `%${search}%` } } },
          { item: { brand: { name: { _ilike: `%${search}%` } } } },
        ],
      });
    }

    // Category filter
    if (category) {
      whereConditions.push({
        item: {
          item_sub_category: {
            item_category: { name: { _ilike: `%${category}%` } },
          },
        },
      });
    }

    // Brand filter
    if (brand) {
      whereConditions.push({
        item: { brand: { name: { _ilike: `%${brand}%` } } },
      });
    }

    // Price filters
    if (min_price !== undefined) {
      whereConditions.push({ selling_price: { _gte: min_price } });
    }
    if (max_price !== undefined) {
      whereConditions.push({ selling_price: { _lte: max_price } });
    }

    // Currency filter
    if (currency) {
      whereConditions.push({ item: { currency: { _eq: currency } } });
    }

    // Location filtering - only show items from supported locations
    // First, validate that requested location is supported
    if (country_code || state) {
      const isLocationSupported = await this.validateLocationSupport(
        country_code,
        state
      );
      if (!isLocationSupported) {
        // Return empty results if location is not supported
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
    }

    // Build location filter
    let supportedLocationFilter: any = {};

    if (country_code || state) {
      // If specific country/state is requested, filter by it
      const locationConditions: any[] = [];

      if (country_code) {
        locationConditions.push({
          business_location: {
            address: { country: { _eq: country_code } },
          },
        });
      }

      if (state) {
        locationConditions.push({
          business_location: {
            address: { state: { _eq: state } },
          },
        });
      }

      supportedLocationFilter = { _and: locationConditions };
    } else {
      // If no specific location requested, still filter by supported locations only
      // This ensures we only show items from countries/states that are supported
      supportedLocationFilter = {
        business_location: {
          address: {
            country: {
              _in: await this.getSupportedCountryCodes(),
            },
          },
        },
      };
    }

    whereConditions.push(supportedLocationFilter);

    const where = whereConditions.length > 0 ? { _and: whereConditions } : {};

    // Calculate offset
    const offset = (page - 1) * limit;

    const queryString = `
      query GetInventoryItems($where: business_inventory_bool_exp!, $limit: Int!, $offset: Int!) {
        business_inventory(where: $where, limit: $limit, offset: $offset, order_by: {created_at: desc}) {
          id
          business_location_id
          item_id
          computed_available_quantity
          selling_price
          is_active
          created_at
          updated_at
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
            sku
            brand {
              id
              name
            }
            model
            color
            is_fragile
            is_perishable
            requires_special_handling
            max_delivery_distance
            estimated_delivery_time
            min_order_quantity
            max_order_quantity
            is_active
            created_at
            updated_at
            item_sub_category {
              id
              name
              item_category {
                id
                name
              }
            }
            item_images {
              id
              image_url
              image_type
              alt_text
              caption
              display_order
            }
            item_tags {
              tag {
                id
                name
              }
            }
          }
          business_location {
            id
            business_id
            name
            location_type
            is_primary
            business {
              id
              name
              is_verified
            }
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
          }
        }
        business_inventory_aggregate(where: $where) {
          aggregate {
            count
          }
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeQuery(queryString, {
        where,
        limit,
        offset,
      });

      const rawItems = result.business_inventory || [];
      const items: InventoryItem[] = rawItems.map((inv: any) =>
        this.mapItemTagsToTags(inv)
      );
      const total = result.business_inventory_aggregate?.aggregate?.count || 0;
      const totalPages = Math.ceil(total / limit);

      const itemsWithMergedImages =
        await this.mergeTaggedBusinessImagesIntoItems(items);

      const inventoryIds = itemsWithMergedImages.map((i) => i.id);
      const viewsMap = await this.getViewCountsByInventoryIds(inventoryIds);
      const dealsMap = await this.getActiveDealsByInventoryIds(inventoryIds);

      const itemsWithViewsAndDeals = itemsWithMergedImages.map((item) => {
        const viewsCount = viewsMap[item.id] ?? 0;
        const deal = dealsMap[item.id];
        const originalPrice = item.selling_price;
        if (!deal) {
          return {
            ...item,
            viewsCount,
            hasActiveDeal: false,
            original_price: originalPrice,
            discounted_price: originalPrice,
            deal_end_at: undefined,
          };
        }

        const discounted = this.applyDealPrice(
          originalPrice,
          deal.discount_type,
          deal.discount_value
        );

        return {
          ...item,
          viewsCount,
          hasActiveDeal: true,
          original_price: originalPrice,
          discounted_price: discounted,
          deal_end_at: deal.end_at,
        };
      });

      const withDistance = await this.enrichWithDistanceOnly(
        itemsWithViewsAndDeals
      );
      const withRatings = await this.attachRatingAggregates(withDistance);
      const finalItems = await this.applySortByMode(
        withRatings,
        sort,
        clientId
      );

      return {
        items: finalItems,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to fetch inventory items:', error);
      throw new HttpException(
        'Failed to fetch inventory items',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Maps item_tags from GraphQL response to item.tags for API response.
   */
  private mapItemTagsToTags(inv: any): InventoryItem {
    if (!inv?.item) return inv;
    const itemTags = inv.item.item_tags ?? [];
    const tags = itemTags.map((it: any) => it.tag);
    const { item_tags: _omit, ...restItem } = inv.item;
    return { ...inv, item: { ...restItem, tags } };
  }

  /**
   * Merges SKU-tagged business_images (first) with item.item_images (second) for each item.
   */
  private async mergeTaggedBusinessImagesIntoItems(
    items: InventoryItem[]
  ): Promise<InventoryItem[]> {
    if (items.length === 0) return items;

    const businessIds = [
      ...new Set(
        items
          .map((i) => i.business_location?.business_id)
          .filter((id): id is string => !!id)
      ),
    ];
    const taggedMap =
      await this.itemImagesMergeService.getTaggedImagesByBusinessAndSku(
        businessIds
      );

    return items.map((item) => {
      const businessId = item.business_location?.business_id;
      const sku =
        typeof item.item?.sku === 'string'
          ? item.item.sku.trim().toLowerCase()
          : '';
      const dbImages: ItemImageShape[] = (item.item?.item_images ?? []).map(
        (img) => ({
          ...img,
          display_order: img.display_order ?? 0,
        })
      );

      if (!businessId || !sku) {
        return item;
      }

      const bySku = taggedMap.get(businessId);
      const tagged = bySku?.get(sku) ?? [];
      const merged = this.itemImagesMergeService.mergeItemImages(
        tagged,
        dbImages,
        item.item?.name
      );

      return {
        ...item,
        item: {
          ...item.item,
          item_images: merged,
        },
      };
    });
  }

  /**
   * Get a specific inventory item by ID
   */
  async getInventoryItemById(id: string): Promise<InventoryItem> {
    const queryString = `
      query GetInventoryItem($id: uuid!) {
        business_inventory_by_pk(id: $id) {
          id
          business_location_id
          item_id
          computed_available_quantity
          selling_price
          is_active
          created_at
          updated_at
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
            sku
            brand {
              id
              name
            }
            model
            color
            is_fragile
            is_perishable
            requires_special_handling
            max_delivery_distance
            estimated_delivery_time
            min_order_quantity
            max_order_quantity
            is_active
            created_at
            updated_at
            item_sub_category {
              id
              name
              item_category {
                id
                name
              }
            }
            item_images {
              id
              image_url
              image_type
              alt_text
              caption
              display_order
            }
            item_tags {
              tag {
                id
                name
              }
            }
          }
          business_location {
            id
            business_id
            name
            location_type
            is_primary
            business {
              id
              name
              is_verified
            }
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
          }
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeQuery(queryString, {
        id,
      });

      let item: InventoryItem | null = result.business_inventory_by_pk;

      if (!item) {
        throw new HttpException(
          'Inventory item not found',
          HttpStatus.NOT_FOUND
        );
      }

      item = this.mapItemTagsToTags(item);
      const [itemWithMergedImages] =
        await this.mergeTaggedBusinessImagesIntoItems([item]);
      item = itemWithMergedImages;

      const viewsMap = await this.getViewCountsByInventoryIds([item.id]);
      const dealsMap = await this.getActiveDealsByInventoryIds([item.id]);
      const deal = dealsMap[item.id];
      const originalPrice = item.selling_price;
      if (!deal) {
        return {
          ...item,
          viewsCount: viewsMap[item.id] ?? 0,
          hasActiveDeal: false,
          original_price: originalPrice,
          discounted_price: originalPrice,
          deal_end_at: undefined,
        };
      }

      const discounted = this.applyDealPrice(
        originalPrice,
        deal.discount_type,
        deal.discount_value
      );

      return {
        ...item,
        viewsCount: viewsMap[item.id] ?? 0,
        hasActiveDeal: true,
        original_price: originalPrice,
        discounted_price: discounted,
        deal_end_at: deal.end_at,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to fetch inventory item ${id}:`, error);
      throw new HttpException(
        'Failed to fetch inventory item',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get similar inventory items (same tags) for a given inventory item ID.
   * Returns up to limit items (default 12) that share at least one tag.
   */
  async getSimilarInventoryItems(
    inventoryItemId: string,
    limit = 12
  ): Promise<InventoryItem[]> {
    const tagQuery = `
      query GetItemTags($id: uuid!) {
        business_inventory_by_pk(id: $id) {
          item_id
          item {
            item_tags {
              tag_id
            }
          }
        }
      }
    `;
    try {
      const tagResult = await this.hasuraSystemService.executeQuery(tagQuery, {
        id: inventoryItemId,
      });
      const row = tagResult.business_inventory_by_pk;
      if (!row?.item?.item_tags?.length) {
        return [];
      }
      const tagIds = row.item.item_tags.map((it: any) => it.tag_id);
      const itemId = row.item_id;

      const similarQuery = `
        query GetSimilarInventoryItems($where: business_inventory_bool_exp!, $limit: Int!) {
          business_inventory(where: $where, limit: $limit, order_by: { created_at: desc }) {
            id
            business_location_id
            item_id
            computed_available_quantity
            selling_price
            is_active
            created_at
            updated_at
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
              sku
              brand { id name }
              model
              color
              is_fragile
              is_perishable
              requires_special_handling
              max_delivery_distance
              estimated_delivery_time
              min_order_quantity
              max_order_quantity
              is_active
              created_at
              updated_at
              item_sub_category { id name item_category { id name } }
              item_images {
                id
                image_url
                image_type
                alt_text
                caption
                display_order
              }
              item_tags {
                tag { id name }
              }
            }
            business_location {
              id
              business_id
              name
              location_type
              is_primary
              business { id name is_verified }
              address {
                id
                address_line_1
                address_line_2
                city
                state
                postal_code
                country
              }
            }
          }
        }
      `;
      const where = {
        _and: [
          { id: { _neq: inventoryItemId } },
          { item_id: { _neq: itemId } },
          { is_active: { _eq: true } },
          { computed_available_quantity: { _gt: 0 } },
          {
            business_location: {
              business: { is_verified: { _eq: true } },
            },
          },
          {
            item: {
              item_tags: {
                tag_id: { _in: tagIds },
              },
            },
          },
        ],
      };
      const similarResult = await this.hasuraSystemService.executeQuery(
        similarQuery,
        { where, limit }
      );
      const rawItems = similarResult.business_inventory || [];
      const items: InventoryItem[] = rawItems.map((inv: any) =>
        this.mapItemTagsToTags(inv)
      );
      const withMergedImages =
        await this.mergeTaggedBusinessImagesIntoItems(items);
      const ids = withMergedImages.map((i) => i.id);
      const viewsMap = await this.getViewCountsByInventoryIds(ids);
      const dealsMap = await this.getActiveDealsByInventoryIds(ids);

      return withMergedImages.map((item) => {
        const viewsCount = viewsMap[item.id] ?? 0;
        const deal = dealsMap[item.id];
        const originalPrice = item.selling_price;
        if (!deal) {
          return {
            ...item,
            viewsCount,
            hasActiveDeal: false,
            original_price: originalPrice,
            discounted_price: originalPrice,
            deal_end_at: undefined,
          };
        }
        const discounted = this.applyDealPrice(
          originalPrice,
          deal.discount_type,
          deal.discount_value
        );
        return {
          ...item,
          viewsCount,
          hasActiveDeal: true,
          original_price: originalPrice,
          discounted_price: discounted,
          deal_end_at: deal.end_at,
        };
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch similar items for ${inventoryItemId}:`,
        error
      );
      return [];
    }
  }

  /**
   * Validate if a location (country/state) is supported for delivery
   */
  private async validateLocationSupport(
    countryCode?: string,
    state?: string
  ): Promise<boolean> {
    try {
      const whereClause: any = {
        service_status: { _eq: 'active' },
        delivery_enabled: { _eq: true },
        ...(countryCode && { country_code: { _eq: countryCode } }),
        ...(state && { state_name: { _eq: state } }),
      };

      const query = `
        query ValidateLocationSupport($where: supported_country_states_bool_exp!) {
          supported_country_states(where: $where, limit: 1) {
            id
          }
        }
      `;

      const response = await this.hasuraSystemService.executeQuery(query, {
        where: whereClause,
      });
      const locations = response.supported_country_states || [];

      return locations.length > 0;
    } catch (error) {
      this.logger.error('Failed to validate location support:', error);
      return false;
    }
  }

  private async getViewCountsByInventoryIds(
    inventoryItemIds: string[]
  ): Promise<Record<string, number>> {
    if (!inventoryItemIds.length) {
      return {};
    }

    const query = `
      query GetItemViewEvents($inventoryItemIds: [uuid!]!) {
        item_view_events(
          where: {
            inventory_item_id: { _in: $inventoryItemIds }
          }
        ) {
          inventory_item_id
          viewer_type
          viewer_id
        }
      }
    `;

    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        inventoryItemIds,
      });

      const events =
        (response.item_view_events as Array<{
          inventory_item_id: string;
          viewer_type: string;
          viewer_id: string;
        }>) ?? [];

      const uniqueViewers: Record<string, Set<string>> = {};

      events.forEach((event) => {
        const key = `${event.viewer_type}:${event.viewer_id}`;
        if (!uniqueViewers[event.inventory_item_id]) {
          uniqueViewers[event.inventory_item_id] = new Set<string>();
        }
        uniqueViewers[event.inventory_item_id].add(key);
      });

      const result: Record<string, number> = {};
      Object.keys(uniqueViewers).forEach((inventoryId) => {
        result[inventoryId] = uniqueViewers[inventoryId].size;
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch item view counts:', error);
      return {};
    }
  }

  private async getActiveDealsByInventoryIds(
    inventoryItemIds: string[]
  ): Promise<
    Record<
      string,
      { discount_type: string; discount_value: number; end_at: string }
    >
  > {
    if (!inventoryItemIds.length) {
      return {};
    }

    const now = new Date().toISOString();

    const query = `
      query GetActiveItemDeals($inventoryItemIds: [uuid!]!, $now: timestamptz!) {
        item_deals(
          where: {
            inventory_item_id: { _in: $inventoryItemIds }
            is_active: { _eq: true }
            start_at: { _lte: $now }
            end_at: { _gte: $now }
          }
        ) {
          inventory_item_id
          discount_type
          discount_value
          end_at
        }
      }
    `;

    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        inventoryItemIds,
        now,
      });

      const deals =
        (response.item_deals as Array<{
          inventory_item_id: string;
          discount_type: string;
          discount_value: number;
          end_at: string;
        }>) ?? [];

      const result: Record<
        string,
        { discount_type: string; discount_value: number; end_at: string }
      > = {};

      deals.forEach((deal) => {
        if (!result[deal.inventory_item_id]) {
          result[deal.inventory_item_id] = {
            discount_type: deal.discount_type,
            discount_value: deal.discount_value,
            end_at: deal.end_at,
          };
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch item deals:', error);
      return {};
    }
  }

  private applyDealPrice(
    basePrice: number,
    discountType: string,
    discountValue: number
  ): number {
    if (discountType === 'percentage') {
      const factor = 1 - discountValue / 100;
      const value = basePrice * factor;
      return value > 0 ? value : 0;
    }

    if (discountType === 'fixed') {
      const value = basePrice - discountValue;
      return value > 0 ? value : 0;
    }

    return basePrice;
  }

  /**
   * Format address for Google Distance Matrix (lat,lng or full string).
   */
  private formatAddressForGoogle(address: {
    latitude?: number | null;
    longitude?: number | null;
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postal_code?: string;
    country: string;
  }): string {
    if (address.latitude != null && address.longitude != null) {
      return `${address.latitude},${address.longitude}`;
    }
    return [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Enrich items with distance from user's primary address (no sort).
   * Returns items unchanged on any error or when user has no primary address.
   */
  private async enrichWithDistanceOnly(
    items: InventoryItem[]
  ): Promise<InventoryItem[]> {
    try {
      const origin = await this.addressesService.getCurrentUserPrimaryAddress();
      if (!origin || items.length === 0) return items;

      const destIds = Array.from(
        new Set(
          items
            .map((i) => i.business_location?.address?.id)
            .filter(Boolean) as string[]
        )
      );
      if (destIds.length === 0) return items;

      const destAddresses =
        await this.addressesService.getAddressesByIds(destIds);
      const destFormatted = destAddresses.map((a) => ({
        id: a.id,
        formatted: this.formatAddressForGoogle(a),
      }));

      const ttl =
        this.configService.get<number>(
          'GOOGLE_INVENTORY_DISTANCE_CACHE_TTL',
          INVENTORY_DISTANCE_CACHE_TTL
        ) ?? INVENTORY_DISTANCE_CACHE_TTL;

      const matrix =
        await this.googleDistanceService.getDistanceMatrixWithCaching(
          origin.id,
          this.formatAddressForGoogle(origin),
          destFormatted,
          { ttlSeconds: ttl }
        );

      const destinationIds = destFormatted.map((d) => d.id);
      return this.attachDistanceToItems(items, matrix, destinationIds);
    } catch (error: any) {
      this.logger.warn(
        `Distance enrichment skipped: ${error?.message ?? String(error)}`
      );
      return items;
    }
  }

  /**
   * Attach distance/duration to each item (no sort).
   */
  private attachDistanceToItems(
    items: InventoryItem[],
    matrix: {
      rows: Array<{
        elements: Array<{
          status: string;
          distance?: { text: string; value: number };
          duration?: { text: string; value: number };
        }>;
      }>;
    },
    destinationIds: string[]
  ): InventoryItem[] {
    const elements = matrix.rows?.[0]?.elements || [];
    return items.map((item) => {
      const addressId = item.business_location?.address?.id;
      const idx = addressId ? destinationIds.indexOf(addressId) : -1;
      const el = idx >= 0 ? elements[idx] : null;
      const hasDistance =
        el?.status === 'OK' && el?.distance && el?.duration;

      return {
        ...item,
        distance_text: hasDistance && el?.distance ? el.distance.text : undefined,
        duration_text: hasDistance && el?.duration ? el.duration.text : undefined,
        distance_value: hasDistance && el?.distance ? el.distance.value : undefined,
      };
    });
  }

  /**
   * Batch-fetch rating aggregates for items and attach avg_rating, rating_count.
   */
  private async attachRatingAggregates(
    items: InventoryItem[]
  ): Promise<InventoryItem[]> {
    const itemIds = Array.from(
      new Set(items.map((i) => i.item?.id).filter(Boolean) as string[])
    );
    if (itemIds.length === 0) return items;

    const query = `
      query GetRatingAggregatesForItems($entityType: String!, $entityIds: [uuid!]!) {
        rating_aggregates(where: { entity_type: { _eq: $entityType }, entity_id: { _in: $entityIds } }) {
          entity_id
          average_rating
          total_ratings
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        entityType: 'item',
        entityIds: itemIds,
      });
      const aggregates = (response.rating_aggregates as Array<{
        entity_id: string;
        average_rating: string | number;
        total_ratings: number;
      }>) ?? [];
      const ratingByItemId: Record<
        string,
        { avg_rating: number; rating_count: number }
      > = {};
      aggregates.forEach((row) => {
        const avg =
          typeof row.average_rating === 'string'
            ? parseFloat(row.average_rating)
            : Number(row.average_rating);
        ratingByItemId[row.entity_id] = {
          avg_rating: Number.isFinite(avg) ? avg : 0,
          rating_count: row.total_ratings ?? 0,
        };
      });

      return items.map((item) => {
        const itemId = item.item?.id;
        const rating = itemId ? ratingByItemId[itemId] : null;
        return {
          ...item,
          avg_rating: rating?.avg_rating ?? null,
          rating_count: rating?.rating_count ?? null,
        };
      });
    } catch (error: any) {
      this.logger.warn(
        `Rating aggregates skipped: ${error?.message ?? String(error)}`
      );
      return items;
    }
  }

  private static readonly RELEVANCE_WEIGHT_ORDERED_INVENTORY = 500;
  private static readonly RELEVANCE_WEIGHT_ORDERED_ITEM = 100;
  private static readonly RELEVANCE_WEIGHT_ORDERED_BRAND = 30;
  private static readonly RELEVANCE_WEIGHT_ORDERED_CATEGORY = 20;
  private static readonly RELEVANCE_WEIGHT_DEAL = 5;
  private static readonly RELEVANCE_DISTANCE_MAX_BOOST = 50;

  private computeRelevanceScore(
    item: InventoryItem,
    orderedInventoryIds: Set<string>,
    orderedItemIds: Set<string>,
    orderedBrandIds: Set<string>,
    orderedCategoryIds: Set<number>
  ): number {
    const viewsCount = item.viewsCount ?? 0;
    let score = 1 + viewsCount;

    if (item.id && orderedInventoryIds.has(item.id)) {
      score += InventoryItemsService.RELEVANCE_WEIGHT_ORDERED_INVENTORY;
    }
    if (item.item_id && orderedItemIds.has(item.item_id)) {
      score += InventoryItemsService.RELEVANCE_WEIGHT_ORDERED_ITEM;
    }
    const brandId = item.item?.brand?.id;
    if (brandId && orderedBrandIds.has(brandId)) {
      score += InventoryItemsService.RELEVANCE_WEIGHT_ORDERED_BRAND;
    }
    const categoryId = item.item?.item_sub_category?.item_category?.id;
    if (
      categoryId !== undefined &&
      orderedCategoryIds.has(categoryId)
    ) {
      score += InventoryItemsService.RELEVANCE_WEIGHT_ORDERED_CATEGORY;
    }
    if (item.hasActiveDeal) {
      score += InventoryItemsService.RELEVANCE_WEIGHT_DEAL;
    }
    const dist = item.distance_value;
    if (dist != null && Number.isFinite(dist)) {
      score += Math.max(
        0,
        InventoryItemsService.RELEVANCE_DISTANCE_MAX_BOOST - dist / 1000
      );
    }
    return score;
  }

  private async getRelevanceSignalsFromPastOrders(
    clientId: string | null
  ): Promise<{
    orderedInventoryIds: Set<string>;
    orderedItemIds: Set<string>;
    orderedBrandIds: Set<string>;
    orderedCategoryIds: Set<number>;
  }> {
    const empty = {
      orderedInventoryIds: new Set<string>(),
      orderedItemIds: new Set<string>(),
      orderedBrandIds: new Set<string>(),
      orderedCategoryIds: new Set<number>(),
    };
    if (!clientId) return empty;

    const query = `
      query GetPastOrderSignals($clientId: uuid!, $status: String!) {
        orders(
          where: { client_id: { _eq: $clientId }, current_status: { _eq: $status } }
          order_by: { created_at: desc }
          limit: 200
        ) {
          order_items {
            business_inventory_id
            business_inventory {
              item_id
              item {
                brand { id }
                item_sub_category { item_category { id } }
              }
            }
          }
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        clientId,
        status: 'complete',
      });
      const orders = (response.orders as Array<{
        order_items: Array<{
          business_inventory_id: string;
          business_inventory: {
            item_id: string;
            item?: {
              brand?: { id: string };
              item_sub_category?: { item_category?: { id: number } };
            };
          };
        }>;
      }>) ?? [];

      const orderedInventoryIds = new Set<string>();
      const orderedItemIds = new Set<string>();
      const orderedBrandIds = new Set<string>();
      const orderedCategoryIds = new Set<number>();

      orders.forEach((order) => {
        (order.order_items || []).forEach((oi) => {
          if (oi.business_inventory_id) {
            orderedInventoryIds.add(oi.business_inventory_id);
          }
          const inv = oi.business_inventory;
          if (inv?.item_id) orderedItemIds.add(inv.item_id);
          const brandId = inv?.item?.brand?.id;
          if (brandId) orderedBrandIds.add(brandId);
          const catId = inv?.item?.item_sub_category?.item_category?.id;
          if (catId !== undefined) orderedCategoryIds.add(catId);
        });
      });

      return {
        orderedInventoryIds,
        orderedItemIds,
        orderedBrandIds,
        orderedCategoryIds,
      };
    } catch (error: any) {
      this.logger.warn(
        `Past order signals skipped: ${error?.message ?? String(error)}`
      );
      return empty;
    }
  }

  /**
   * Apply sort (or filter+sort for deals) based on sort mode.
   */
  private async applySortByMode(
    items: InventoryItem[],
    sort: InventorySortMode,
    clientId: string | null
  ): Promise<InventoryItem[]> {
    switch (sort) {
      case 'relevance': {
        return this.applyRelevanceSort(items, clientId);
      }
      case 'fastest': {
        const sorted = [...items];
        sorted.sort((a, b) => {
          const aVal = a.distance_value ?? Infinity;
          const bVal = b.distance_value ?? Infinity;
          if (aVal !== bVal) return aVal - bVal;
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        });
        return sorted;
      }
      case 'cheapest': {
        const sorted = [...items];
        sorted.sort((a, b) => {
          const aPrice = a.discounted_price ?? a.selling_price;
          const bPrice = b.discounted_price ?? b.selling_price;
          if (aPrice !== bPrice) return aPrice - bPrice;
          const aDist = a.distance_value ?? Infinity;
          const bDist = b.distance_value ?? Infinity;
          if (aDist !== bDist) return aDist - bDist;
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        });
        return sorted;
      }
      case 'top_rated': {
        const sorted = [...items];
        sorted.sort((a, b) => {
          const aAvg = a.avg_rating ?? 0;
          const bAvg = b.avg_rating ?? 0;
          if (bAvg !== aAvg) return bAvg - aAvg;
          const aCount = a.rating_count ?? 0;
          const bCount = b.rating_count ?? 0;
          if (bCount !== aCount) return bCount - aCount;
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        });
        return sorted;
      }
      case 'deals': {
        const withDeals = items.filter((i) => i.hasActiveDeal === true);
        withDeals.sort((a, b) => {
          const aOrig = a.original_price ?? a.selling_price;
          const bOrig = b.original_price ?? b.selling_price;
          const aDisc = a.discounted_price ?? a.selling_price;
          const bDisc = b.discounted_price ?? b.selling_price;
          const aPct = aOrig > 0 ? ((aOrig - aDisc) / aOrig) * 100 : 0;
          const bPct = bOrig > 0 ? ((bOrig - bDisc) / bOrig) * 100 : 0;
          if (bPct !== aPct) return bPct - aPct;
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        });
        return withDeals;
      }
      default:
        return items;
    }
  }

  private async applyRelevanceSort(
    items: InventoryItem[],
    clientId: string | null
  ): Promise<InventoryItem[]> {
    const signals = await this.getRelevanceSignalsFromPastOrders(clientId);
    const sorted = [...items];
    sorted.sort((a, b) => {
      const scoreA = this.computeRelevanceScore(
        a,
        signals.orderedInventoryIds,
        signals.orderedItemIds,
        signals.orderedBrandIds,
        signals.orderedCategoryIds
      );
      const scoreB = this.computeRelevanceScore(
        b,
        signals.orderedInventoryIds,
        signals.orderedItemIds,
        signals.orderedBrandIds,
        signals.orderedCategoryIds
      );
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    return sorted;
  }

  /** Public rentals catalog shares the same geo rules as inventory. */
  async isCatalogLocationSupported(
    countryCode?: string,
    state?: string
  ): Promise<boolean> {
    return this.validateLocationSupport(countryCode, state);
  }

  async getActiveSupportedCountryCodes(): Promise<string[]> {
    return this.getSupportedCountryCodes();
  }

  /**
   * Get list of supported country codes from supported_country_states table
   */
  private async getSupportedCountryCodes(): Promise<string[]> {
    try {
      const query = `
        query GetSupportedCountryCodes {
          supported_country_states(
            where: { 
              service_status: { _eq: "active" },
              delivery_enabled: { _eq: true }
            },
            distinct_on: [country_code]
          ) {
            country_code
          }
        }
      `;

      const response = await this.hasuraSystemService.executeQuery(query);
      const locations = response.supported_country_states || [];

      return locations.map((loc: any) => loc.country_code);
    } catch (error) {
      this.logger.error('Failed to fetch supported country codes:', error);
      // Return empty array as fallback - this will show no items if there's an error
      return [];
    }
  }
}
