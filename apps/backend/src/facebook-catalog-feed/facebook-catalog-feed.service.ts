import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  fetchStripeEnabledCountries,
  isLocationPaymentsEnabled,
  type CatalogLocationPhoneGate,
} from '../inventory-items/inventory-catalog-eligibility.util';
import {
  buildFacebookCatalogCsvFromInventories,
  type FeedInventoryRow,
} from './facebook-catalog-csv.util';

const PAGE_SIZE = 500;
/** Soft cap aligned with public catalog scans; prevents OOM on Meta fetch. */
const FEED_FETCH_MAX = 20000;

const FEED_INVENTORY_GQL = `
  query FacebookCatalogFeed($where: business_inventory_bool_exp!, $limit: Int!, $offset: Int!) {
    business_inventory(
      where: $where
      limit: $limit
      offset: $offset
      order_by: { id: asc }
    ) {
      id
      selling_price
      computed_available_quantity
      sibling_inventory(
        where: { item_variant_id: { _is_null: false }, is_active: { _eq: true } }
      ) {
        computed_available_quantity
        item_variant { quantity }
      }
      is_active
      item_variant_id
      item_variant {
        item_variant_images(order_by: { display_order: asc }) {
          image_url
          display_order
          is_primary
        }
      }
      item {
        name
        description
        price
        currency
        is_used
        brand { name }
        item_images(order_by: { display_order: asc }) {
          image_url
          image_type
          display_order
        }
        item_tags { tag { name } }
        item_sub_category {
          google_product_category
          fb_product_category
          item_category { name }
          google_product_category_row { id name_en name_fr }
          fb_product_category_row { id name_en name_fr }
        }
      }
      business_location {
        name
        mobile_payment_phone { is_verified }
        address { country }
        business { name }
      }
    }
  }
`;

type FeedQueryLocation = CatalogLocationPhoneGate & {
  name?: string | null;
  business?: { name?: string | null } | null;
};

type FeedSiblingRow = {
  computed_available_quantity?: number | null;
  item_variant?: { quantity?: number | null } | null;
};

type FeedQueryRow = FeedInventoryRow & {
  business_location?: FeedQueryLocation | null;
  sibling_inventory?: FeedSiblingRow[] | null;
};

@Injectable()
export class FacebookCatalogFeedService {
  private readonly logger = new Logger(FacebookCatalogFeedService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  async buildCsv(): Promise<{ csv: string; rowCount: number }> {
    const inventories = await this.fetchEligibleInventories();
    const webOrigin =
      this.configService.get<string>('publicWebAppUrl') ||
      'https://rendasua.com';
    return buildFacebookCatalogCsvFromInventories({
      inventories,
      webOrigin,
      productCategoryLanguage: 'en',
    });
  }

  private buildFeedWhere(): Record<string, unknown> {
    return {
      _and: [
        { is_active: { _eq: true } },
        { item_variant_id: { _is_null: true } },
        {
          item: {
            moderation_status: { _eq: 'approved' },
            export_available: { _eq: false },
          },
        },
        {
          business_location: {
            is_active: { _eq: true },
            business: { can_accept_orders: { _eq: true } },
          },
        },
      ],
    };
  }

  private async fetchEligibleInventories(): Promise<FeedInventoryRow[]> {
    const stripeCountries = await fetchStripeEnabledCountries(this.hasura);
    const eligible: FeedInventoryRow[] = [];
    let offset = 0;
    for (;;) {
      if (offset >= FEED_FETCH_MAX) {
        this.logger.warn(
          `Facebook catalog feed hit fetch cap (${FEED_FETCH_MAX}); truncating`
        );
        break;
      }
      const page = await this.fetchPage(offset);
      if (page.length === 0) break;
      for (const row of page) {
        if (this.isPaymentsEligible(row, stripeCountries)) {
          eligible.push(this.withSellableStock(row));
        }
      }
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    this.logger.log(`Facebook catalog feed: ${eligible.length} eligible rows`);
    return eligible;
  }

  private async fetchPage(offset: number): Promise<FeedQueryRow[]> {
    const res = await this.hasura.executeQuery<{
      business_inventory: FeedQueryRow[];
    }>(FEED_INVENTORY_GQL, {
      where: this.buildFeedWhere(),
      limit: PAGE_SIZE,
      offset,
    });
    return res.business_inventory ?? [];
  }

  private withSellableStock(row: FeedQueryRow): FeedInventoryRow {
    return { ...row, computed_available_quantity: sellableFeedUnits(row) };
  }

  private isPaymentsEligible(
    row: FeedQueryRow,
    stripeCountries: string[]
  ): boolean {
    return isLocationPaymentsEnabled(row.business_location, stripeCountries);
  }
}

function sellableFeedUnits(row: FeedQueryRow): number | null | undefined {
  const sibling = purchasableSiblingUnits(row);
  const parent = Number(row.computed_available_quantity ?? 0);
  const base = Number.isFinite(parent) ? Math.max(0, parent) : 0;
  if (base <= 0 && sibling <= 0 && row.computed_available_quantity == null) {
    return row.computed_available_quantity;
  }
  return base + sibling;
}

function purchasableSiblingUnits(row: FeedQueryRow): number {
  let total = 0;
  for (const sibling of row.sibling_inventory ?? []) {
    if (siblingCanSell(sibling)) total += Number(sibling.computed_available_quantity ?? 0);
  }
  return total;
}

function siblingCanSell(sibling: FeedSiblingRow): boolean {
  const available = Number(sibling.computed_available_quantity ?? 0);
  const pack = Number(sibling.item_variant?.quantity ?? 1);
  const size = Number.isFinite(pack) && pack > 1 ? Math.floor(pack) : 1;
  return Number.isFinite(available) && available >= size;
}
