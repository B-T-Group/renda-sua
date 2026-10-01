import { BadRequestException, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  ADMIN_MAP_AGENTS_QUERY,
  ADMIN_MAP_LOCATIONS_QUERY,
  ADMIN_MAP_REGIONS_QUERY,
  ADMIN_MAP_SEARCH_AGENTS_QUERY,
  ADMIN_MAP_SEARCH_LOCATIONS_QUERY,
  ADMIN_MAP_SEARCH_ORDERS_QUERY,
} from './admin-map.queries';
import {
  AdminMapFilter,
  AdminMapPin,
  AdminMapSearchHit,
  AdminMapSummary,
  AgentMapSource,
  LocationMapSource,
  OrderMapSource,
} from './admin-map.types';
import {
  agentSearchHit,
  locationSearchHit,
  mergePins,
  merchantNameWhere,
  normalizeCountryCode,
  activeOrdersWhere,
  orderSearchHit,
  personNameWhere,
  pinsForKind,
  searchTokens,
  summarizeMarket,
  uniqueStateNames,
} from './admin-map.util';
import { AdminMapPinsQueryDto } from './dto/admin-map-query.dto';

function peopleHits(
  agents: AgentMapSource[],
  locations: LocationMapSource[]
): AdminMapSearchHit[] {
  return [...agents.map(agentSearchHit), ...locations.map(locationSearchHit)];
}

interface RegionRow {
  state_name?: string | null;
  country_name?: string | null;
}

@Injectable()
export class AdminMapService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getRegions(countryCode: string): Promise<{ regions: { stateName: string }[] }> {
    const code = normalizeCountryCode(countryCode);
    if (!code) throw new BadRequestException('country is required');
    const rows = await this.loadRegions(code);
    return { regions: uniqueStateNames(rows).map((stateName) => ({ stateName })) };
  }

  async search(term: string): Promise<{ results: AdminMapSearchHit[] }> {
    const tokens = searchTokens(term);
    if (tokens.join('').length < 2) return { results: [] };
    const [agents, locations] = await Promise.all([
      this.findAgents(tokens),
      this.findLocations(tokens),
    ]);
    return { results: peopleHits(agents, locations) };
  }

  async activeOrders(term: string): Promise<{ results: AdminMapSearchHit[] }> {
    const orders = await this.loadOrders(activeOrdersWhere(term), 30);
    return { results: orders.map(orderSearchHit) };
  }

  async getPins(
    query: AdminMapPinsQueryDto
  ): Promise<{ pins: AdminMapPin[]; summary: AdminMapSummary }> {
    const filter = await this.buildFilter(query);
    const [agents, locations] = await this.loadRows();
    const matched = mergePins(agents, locations, filter);
    return {
      pins: pinsForKind(matched, query.kind ?? 'all'),
      summary: summarizeMarket(agents, locations, filter),
    };
  }

  private async buildFilter(query: AdminMapPinsQueryDto): Promise<AdminMapFilter> {
    const countryCode = normalizeCountryCode(query.country);
    const rows = countryCode ? await this.loadRegions(countryCode) : [];
    return {
      countryCode: countryCode ?? undefined,
      countryName: rows[0]?.country_name ?? null,
      state: query.state?.trim() || undefined,
    };
  }

  private loadRows() {
    return Promise.all([this.loadAgents(), this.loadLocations()]);
  }

  private async loadAgents(): Promise<AgentMapSource[]> {
    const data = await this.hasuraSystemService.executeQuery<{
      agents: AgentMapSource[];
    }>(ADMIN_MAP_AGENTS_QUERY);
    return data.agents ?? [];
  }

  private async loadLocations(): Promise<LocationMapSource[]> {
    const data = await this.hasuraSystemService.executeQuery<{
      business_locations: LocationMapSource[];
    }>(ADMIN_MAP_LOCATIONS_QUERY);
    return data.business_locations ?? [];
  }

  private async findAgents(tokens: string[]): Promise<AgentMapSource[]> {
    const data = await this.hasuraSystemService.executeQuery<{ agents: AgentMapSource[] }>(
      ADMIN_MAP_SEARCH_AGENTS_QUERY,
      { where: personNameWhere(tokens) }
    );
    return data.agents ?? [];
  }

  private async findLocations(tokens: string[]): Promise<LocationMapSource[]> {
    const data = await this.hasuraSystemService.executeQuery<{
      business_locations: LocationMapSource[];
    }>(ADMIN_MAP_SEARCH_LOCATIONS_QUERY, { where: merchantNameWhere(tokens) });
    return data.business_locations ?? [];
  }

  private async loadOrders(where: object, limit: number): Promise<OrderMapSource[]> {
    const data = await this.hasuraSystemService.executeQuery<{ orders: OrderMapSource[] }>(
      ADMIN_MAP_SEARCH_ORDERS_QUERY,
      { where, limit }
    );
    return data.orders ?? [];
  }

  private async loadRegions(code: string): Promise<RegionRow[]> {
    const data = await this.hasuraSystemService.executeQuery<{
      supported_country_states: RegionRow[];
    }>(ADMIN_MAP_REGIONS_QUERY, { code });
    return data.supported_country_states ?? [];
  }
}
