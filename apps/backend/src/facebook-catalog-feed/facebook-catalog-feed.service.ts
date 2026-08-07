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
      is_active
      item_variant_id
      item_variant {
        item_variant_images(order_by: { display_order: asc }) {
          image_url
          display_url
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
          display_url
        }
        item_tags { tag { name } }
        item_sub_category {
          google_product_category
          fb_product_category
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

type FeedQueryRow = FeedInventoryRow & {
  business_location?: FeedQueryLocation | null;
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
        { item: { moderation_status: { _eq: 'approved' } } },
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
          eligible.push(row);
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

  private isPaymentsEligible(
    row: FeedQueryRow,
    stripeCountries: string[]
  ): boolean {
    return isLocationPaymentsEnabled(row.business_location, stripeCountries);
  }
}
