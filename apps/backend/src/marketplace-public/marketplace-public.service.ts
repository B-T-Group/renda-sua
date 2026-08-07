import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type {
  MarketplaceLogoDto,
  MarketplacePublicStatsDto,
} from './marketplace-public.types';

const SETUP_MINUTES_MAX = 5;
const SECURE_PAYMENTS_PERCENT = 100;
const LOGO_LIMIT = 12;
const CITY_SCAN_LIMIT = 2000;

interface AggregateCount {
  aggregate?: { count?: number | null } | null;
}

interface LocationRow {
  id: string;
  name?: string | null;
  logo_url?: string | null;
  address?: { city?: string | null } | null;
}

interface StatsQueryResult {
  businesses_aggregate: AggregateCount;
  business_inventory_aggregate: AggregateCount;
  orders_aggregate: AggregateCount;
  city_locations: LocationRow[];
  logo_locations: LocationRow[];
}

@Injectable()
export class MarketplacePublicService {
  private readonly logger = new Logger(MarketplacePublicService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async getPublicStats(): Promise<MarketplacePublicStatsDto> {
    try {
      const data = await this.fetchStats();
      return this.mapStats(data);
    } catch (error: any) {
      this.logger.error(
        `Failed to load marketplace public stats: ${error?.message}`
      );
      return this.emptyStats();
    }
  }

  private async fetchStats(): Promise<StatsQueryResult> {
    const query = `
      query MarketplacePublicStats($cityLimit: Int!, $logoLimit: Int!) {
        businesses_aggregate(where: { can_accept_orders: { _eq: true } }) {
          aggregate { count }
        }
        business_inventory_aggregate(
          where: {
            is_active: { _eq: true }
            item: { moderation_status: { _eq: "approved" } }
            business_location: {
              is_active: { _eq: true }
              business: { can_accept_orders: { _eq: true } }
            }
          }
        ) {
          aggregate { count }
        }
        orders_aggregate(
          where: { current_status: { _in: ["delivered", "complete"] } }
        ) {
          aggregate { count }
        }
        city_locations: business_locations(
          where: {
            is_active: { _eq: true }
            business: { can_accept_orders: { _eq: true } }
            address: { city: { _is_null: false, _neq: "" } }
          }
          limit: $cityLimit
          order_by: { created_at: desc }
        ) {
          id
          address { city }
        }
        logo_locations: business_locations(
          where: {
            is_active: { _eq: true }
            business: { can_accept_orders: { _eq: true } }
            logo_url: { _is_null: false, _neq: "" }
          }
          limit: $logoLimit
          order_by: { created_at: desc }
        ) {
          id
          name
          logo_url
        }
      }
    `;
    return this.hasura.executeQuery<StatsQueryResult>(query, {
      cityLimit: CITY_SCAN_LIMIT,
      logoLimit: LOGO_LIMIT,
    });
  }

  private mapStats(data: StatsQueryResult): MarketplacePublicStatsDto {
    return {
      merchants: this.countOf(data.businesses_aggregate),
      products: this.countOf(data.business_inventory_aggregate),
      cities: this.countDistinctCities(data.city_locations ?? []),
      orders: this.countOf(data.orders_aggregate),
      setupMinutesMax: SETUP_MINUTES_MAX,
      securePaymentsPercent: SECURE_PAYMENTS_PERCENT,
      logos: this.mapLogos(data.logo_locations ?? []),
    };
  }

  private countOf(agg: AggregateCount | undefined): number {
    return agg?.aggregate?.count ?? 0;
  }

  private countDistinctCities(locations: LocationRow[]): number {
    const cities = new Set<string>();
    for (const loc of locations) {
      const city = loc.address?.city?.trim().toLowerCase();
      if (city) cities.add(city);
    }
    return cities.size;
  }

  private mapLogos(locations: LocationRow[]): MarketplaceLogoDto[] {
    const logos: MarketplaceLogoDto[] = [];
    const seen = new Set<string>();
    for (const loc of locations) {
      const url = loc.logo_url?.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      logos.push({
        id: loc.id,
        name: loc.name?.trim() || 'Store',
        logoUrl: url,
      });
    }
    return logos;
  }

  private emptyStats(): MarketplacePublicStatsDto {
    return {
      merchants: 0,
      products: 0,
      cities: 0,
      orders: 0,
      setupMinutesMax: SETUP_MINUTES_MAX,
      securePaymentsPercent: SECURE_PAYMENTS_PERCENT,
      logos: [],
    };
  }
}
