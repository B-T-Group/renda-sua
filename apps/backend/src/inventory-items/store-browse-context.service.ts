import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  localizeCollectionRow,
  resolveCollectionLang,
} from '../collections/collection-localization.util';
import type { CollectionSummary } from '../collections/collections.service';
import { FOOD_CATEGORY_NAME } from '../food/food.constants';
import { VariantInventoryService } from '../item-variants/variant-inventory.service';
import {
  InventoryItemsService,
  type InventoryItem,
} from './inventory-items.service';

export interface StoreBrowseCategory {
  id: number;
  name: string;
  item_count: number;
}

export interface StorePopularGroup {
  category_name: string;
  items: InventoryItem[];
}

export interface StoreBrowseContext {
  business_location_id: string;
  categories: StoreBrowseCategory[];
  deals: InventoryItem[];
  popular: StorePopularGroup[];
  collections: CollectionSummary[];
}

export interface StoreBrowseContextQuery {
  food_only?: boolean;
  owner_preview?: boolean;
  lang?: string;
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
    brand { id name }
    sku
    item_sub_category {
      id
      name
      item_category { id name }
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
      quantity
      is_active
    }
  }
  business_location {
    id
    name
    address { id city }
    business { id name is_verified can_accept_orders }
  }
`;

const MAX_POPULAR_CATEGORIES = 3;
const MIN_POPULAR_CATEGORY_ITEMS = 2;
const POPULAR_ITEMS_LIMIT = 6;
const DEALS_LIMIT = 8;
const COLLECTIONS_LIMIT = 8;

@Injectable()
export class StoreBrowseContextService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly variantInventory: VariantInventoryService
  ) {}

  async getBrowseContext(
    idParam: string,
    query: StoreBrowseContextQuery = {}
  ): Promise<StoreBrowseContext | null> {
    const store = await this.inventoryItemsService.getInventoryStoreById(
      idParam,
      { owner_preview: query.owner_preview === true }
    );
    if (!store) return null;

    const locationId = store.business_location_id;
    const foodOnly = query.food_only === true;
    const [categories, deals, collections] = await Promise.all([
      this.fetchCategories(locationId, foodOnly),
      this.fetchDeals(locationId, foodOnly),
      this.fetchCollections(locationId, foodOnly, query.lang),
    ]);
    const popular = await this.fetchPopular(locationId, categories, foodOnly);
    return {
      business_location_id: locationId,
      categories,
      deals,
      popular,
      collections,
    };
  }

  private baseInventoryWhere(
    locationId: string,
    foodOnly: boolean
  ): Record<string, unknown> {
    const itemFilter: Record<string, unknown> = {
      is_active: { _eq: true },
      moderation_status: { _eq: 'approved' },
    };
    if (foodOnly) {
      itemFilter.item_sub_category = {
        item_category: { name: { _eq: FOOD_CATEGORY_NAME } },
      };
    }
    return {
      is_active: { _eq: true },
      item_variant_id: { _is_null: true },
      business_location_id: { _eq: locationId },
      item: itemFilter,
      _or: [
        { computed_available_quantity: { _gt: 0 } },
        {
          sibling_inventory: {
            item_variant_id: { _is_null: false },
            is_active: { _eq: true },
            computed_available_quantity: { _gt: 0 },
          },
        },
      ],
    };
  }

  private async fetchCategories(
    locationId: string,
    foodOnly: boolean
  ): Promise<StoreBrowseCategory[]> {
    const gql = `
      query StoreBrowseCategories($where: business_inventory_bool_exp!) {
        business_inventory(where: $where, limit: 2000) {
          item {
            item_sub_category {
              item_category { id name }
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(gql, {
      where: this.baseInventoryWhere(locationId, foodOnly),
    });
    return this.aggregateCategories(result?.business_inventory ?? []);
  }

  private aggregateCategories(
    rows: Array<{
      item?: {
        item_sub_category?: {
          item_category?: { id?: number; name?: string } | null;
        } | null;
      } | null;
    }>
  ): StoreBrowseCategory[] {
    const counts = new Map<number, StoreBrowseCategory>();
    for (const row of rows) {
      const cat = row.item?.item_sub_category?.item_category;
      if (!cat?.id || !cat.name) continue;
      const existing = counts.get(cat.id);
      if (existing) {
        existing.item_count += 1;
      } else {
        counts.set(cat.id, { id: cat.id, name: cat.name, item_count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.item_count - a.item_count);
  }

  private async fetchDeals(
    locationId: string,
    foodOnly: boolean
  ): Promise<InventoryItem[]> {
    const now = new Date().toISOString();
    const inventoryWhere = this.baseInventoryWhere(locationId, foodOnly);
    const gql = `
      query StoreBrowseDeals(
        $now: timestamptz!
        $inventoryWhere: business_inventory_bool_exp!
        $limit: Int!
      ) {
        item_deals(
          where: {
            is_active: { _eq: true }
            start_at: { _lte: $now }
            end_at: { _gte: $now }
            business_inventory: $inventoryWhere
          }
          limit: $limit
          order_by: { start_at: desc }
        ) {
          discount_type
          discount_value
          end_at
          business_inventory { ${INVENTORY_ITEM_SELECTION} }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(gql, {
      now,
      inventoryWhere,
      limit: DEALS_LIMIT,
    });
    const deals = (result?.item_deals ?? []) as Array<{
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      end_at: string;
      business_inventory: InventoryItem;
    }>;
    const listings = deals.map((d) => d.business_inventory);
    await this.variantInventory.attachAvailableQuantities(listings);
    return deals.map((deal) => this.mapDealItem(deal));
  }

  private async fetchPopular(
    locationId: string,
    categories: StoreBrowseCategory[],
    foodOnly: boolean
  ): Promise<StorePopularGroup[]> {
    const eligible = categories
      .filter((c) => c.item_count >= MIN_POPULAR_CATEGORY_ITEMS)
      .slice(0, MAX_POPULAR_CATEGORIES);
    const groups: StorePopularGroup[] = [];
    for (const category of eligible) {
      const items = await this.fetchTopInCategory(
        locationId,
        category.name,
        foodOnly
      );
      if (items.length >= MIN_POPULAR_CATEGORY_ITEMS) {
        groups.push({ category_name: category.name, items });
      }
    }
    return groups;
  }

  private async fetchTopInCategory(
    locationId: string,
    categoryName: string,
    foodOnly: boolean
  ): Promise<InventoryItem[]> {
    const where = this.baseInventoryWhere(locationId, foodOnly);
    const item = where.item as Record<string, unknown>;
    item.item_sub_category = {
      item_category: { name: { _ilike: `%${categoryName}%` } },
    };
    const gql = `
      query StoreBrowseTopInCategory(
        $where: business_inventory_bool_exp!
        $limit: Int!
      ) {
        business_inventory(where: $where, limit: $limit) {
          ${INVENTORY_ITEM_SELECTION}
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(gql, {
      where,
      limit: POPULAR_ITEMS_LIMIT,
    });
    const listings = (result?.business_inventory ?? []) as InventoryItem[];
    await this.variantInventory.attachAvailableQuantities(listings);
    return this.enrichWithRatings(listings);
  }

  private async fetchCollections(
    locationId: string,
    foodOnly: boolean,
    lang?: string
  ): Promise<CollectionSummary[]> {
    const resolvedLang = resolveCollectionLang(lang);
    const where = this.baseInventoryWhere(locationId, foodOnly);
    const gql = `
      query StoreBrowseCollections($where: business_inventory_bool_exp!) {
        business_inventory(where: $where, limit: 2000) {
          item_id
          item {
            item_images(
              where: { is_active: { _eq: true }, image_url: { _is_null: false } }
              order_by: { display_order: asc }
              limit: 1
            ) { image_url display_url }
            item_collections {
              collection {
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
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(gql, { where });
    return this.aggregateCollections(
      result?.business_inventory ?? [],
      resolvedLang
    );
  }

  private aggregateCollections(
    rows: Array<{
      item_id?: string;
      item?: {
        item_images?: Array<{
          image_url?: string | null;
          display_url?: string | null;
        }>;
        item_collections?: Array<{
          collection?: {
            id: string;
            slug: string;
            name_en: string;
            name_fr: string;
            description_en?: string | null;
            description_fr?: string | null;
            image_url?: string | null;
            is_featured: boolean;
            sort_order: number;
          } | null;
        }>;
      } | null;
    }>,
    lang: 'en' | 'fr'
  ): CollectionSummary[] {
    type Acc = CollectionSummary & { seenItems: Set<string> };
    const bySlug = new Map<string, Acc>();
    for (const row of rows) {
      const image =
        row.item?.item_images?.[0]?.display_url ||
        row.item?.item_images?.[0]?.image_url ||
        null;
      for (const link of row.item?.item_collections ?? []) {
        const col = link.collection;
        if (!col?.slug) continue;
        let acc = bySlug.get(col.slug);
        if (!acc) {
          const localized = localizeCollectionRow(col, lang);
          acc = {
            id: col.id,
            slug: col.slug,
            name: localized.name,
            description: localized.description,
            image_url: col.image_url ?? null,
            preview_image_urls: [],
            is_featured: col.is_featured,
            sort_order: col.sort_order,
            listing_count: 0,
            seenItems: new Set(),
          };
          bySlug.set(col.slug, acc);
        }
        if (row.item_id && !acc.seenItems.has(row.item_id)) {
          acc.seenItems.add(row.item_id);
          acc.listing_count += 1;
          if (image && acc.preview_image_urls.length < 4) {
            acc.preview_image_urls.push(image);
          }
        }
      }
    }
    return [...bySlug.values()]
      .filter((c) => c.listing_count >= 1)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .slice(0, COLLECTIONS_LIMIT)
      .map(({ seenItems: _seen, ...summary }) => summary);
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

  private async enrichWithRatings(
    listings: InventoryItem[]
  ): Promise<InventoryItem[]> {
    const itemIds = listings.map((l) => l.item_id);
    if (!itemIds.length) return [];
    const statsResult = await this.hasuraSystemService.executeQuery(
      `
      query StoreBrowseItemStats($itemIds: [uuid!]!) {
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
    `,
      { itemIds }
    );
    const ratings = (statsResult?.rating_aggregates ?? []) as Array<{
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
