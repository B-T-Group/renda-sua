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
const STATS_CACHE_TTL_MS = 60_000;

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
  clients_aggregate: AggregateCount;
  agents_aggregate: AggregateCount;
  businesses_aggregate: AggregateCount;
  business_inventory_aggregate: AggregateCount;
  orders_aggregate: AggregateCount;
  city_locations: LocationRow[];
  logo_locations: LocationRow[];
}

@Injectable()
export class MarketplacePublicService {
  private readonly logger = new Logger(MarketplacePublicService.name);
  private cache: { stats: MarketplacePublicStatsDto; expiresAt: number } | null =
    null;

  constructor(private readonly hasura: HasuraSystemService) {}

  async getPublicStats(): Promise<MarketplacePublicStatsDto> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.stats;
    }
    try {
      return this.storeCache(this.mapStats(await this.fetchStats()));
    } catch (error: any) {
      this.logger.error(
        `Failed to load marketplace public stats: ${error?.message}`
      );
      return this.cache?.stats ?? this.emptyStats();
    }
  }

  private storeCache(stats: MarketplacePublicStatsDto): MarketplacePublicStatsDto {
    this.cache = { stats, expiresAt: Date.now() + STATS_CACHE_TTL_MS };
    return stats;
  }

  private async fetchStats(): Promise<StatsQueryResult> {
    const query = `
      query MarketplacePublicStats($cityLimit: Int!, $logoLimit: Int!) {
        clients_aggregate(
          where: { user: { account_status: { _neq: "deleted" } } }
        ) {
          aggregate { count }
        }
        agents_aggregate(where: { is_verified: { _eq: true } }) {
          aggregate { count }
        }
        businesses_aggregate(where: { is_storefront_visible: { _eq: true } }) {
          aggregate { count }
        }
        business_inventory_aggregate(
          where: {
            is_active: { _eq: true }
            item: { moderation_status: { _eq: "approved" } }
            business_location: {
              is_active: { _eq: true }
              business: { is_storefront_visible: { _eq: true } }
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
            business: { is_storefront_visible: { _eq: true } }
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
            business: { is_storefront_visible: { _eq: true } }
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
      clients: this.countOf(data.clients_aggregate),
      agents: this.countOf(data.agents_aggregate),
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
      clients: 0,
      agents: 0,
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
