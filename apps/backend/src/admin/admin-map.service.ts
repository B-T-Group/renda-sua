import { BadRequestException, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  andWhere,
  countryInScope,
  scopeCovers,
  stateInScope,
  type MarketRow,
} from '../rbac/geo-scope.util';
import type { GeoScope } from '../rbac/platform-permissions';
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

  async getRegions(
    countryCode: string,
    scope?: GeoScope
  ): Promise<{ regions: { stateName: string }[] }> {
    const code = normalizeCountryCode(countryCode);
    if (!code) throw new BadRequestException('country is required');
    this.assertCountry(scope, code);
    const rows = await this.loadRegions(code);
    const names = uniqueStateNames(rows).filter((stateName) =>
      this.regionAllowed(scope, code, stateName)
    );
    return { regions: names.map((stateName) => ({ stateName })) };
  }

  async search(
    term: string,
    addressWhere?: Record<string, unknown> | null
  ): Promise<{ results: AdminMapSearchHit[] }> {
    const tokens = searchTokens(term);
    if (tokens.join('').length < 2) return { results: [] };
    const [agents, locations] = await Promise.all([
      this.findAgents(tokens, addressWhere),
      this.findLocations(tokens, addressWhere),
    ]);
    return { results: peopleHits(agents, locations) };
  }

  async activeOrders(
    term: string,
    orderWhere?: Record<string, unknown> | null
  ): Promise<{ results: AdminMapSearchHit[] }> {
    const orders = await this.loadOrders(
      andWhere(activeOrdersWhere(term), orderWhere),
      30
    );
    return { results: orders.map(orderSearchHit) };
  }

  async getPins(
    query: AdminMapPinsQueryDto,
    scope?: GeoScope,
    markets: MarketRow[] = []
  ): Promise<{ pins: AdminMapPin[]; summary: AdminMapSummary }> {
    const filter = await this.buildFilter(query);
    this.assertCountry(scope, filter.countryCode);
    this.assertState(scope, filter);
    const [agents, locations] = await this.loadRows();
    const visible = this.rowsInScope(agents, locations, scope, markets);
    const matched = mergePins(visible.agents, visible.locations, filter);
    return {
      pins: pinsForKind(matched, query.kind ?? 'all'),
      summary: summarizeMarket(visible.agents, visible.locations, filter),
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

  private async findAgents(
    tokens: string[],
    addressWhere?: Record<string, unknown> | null
  ): Promise<AgentMapSource[]> {
    const data = await this.hasuraSystemService.executeQuery<{ agents: AgentMapSource[] }>(
      ADMIN_MAP_SEARCH_AGENTS_QUERY,
      {
        where: andWhere(
          personNameWhere(tokens),
          addressWhere ? { agent_addresses: { address: addressWhere } } : null
        ),
      }
    );
    return data.agents ?? [];
  }

  private async findLocations(
    tokens: string[],
    addressWhere?: Record<string, unknown> | null
  ): Promise<LocationMapSource[]> {
    const data = await this.hasuraSystemService.executeQuery<{
      business_locations: LocationMapSource[];
    }>(ADMIN_MAP_SEARCH_LOCATIONS_QUERY, {
      where: andWhere(merchantNameWhere(tokens), addressWhere ? { address: addressWhere } : null),
    });
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

  private assertCountry(scope: GeoScope | undefined, code?: string): void {
    if (!scope || scope.all || !code) return;
    if (!countryInScope(scope, code)) {
      throw new BadRequestException('Country is outside your scope');
    }
  }

  private assertState(scope: GeoScope | undefined, filter: AdminMapFilter): void {
    if (!filter.state || !scope || scope.all) return;
    if (!stateInScope(scope, filter.countryCode ?? '', filter.state)) {
      throw new BadRequestException('Region is outside your scope');
    }
  }

  private rowsInScope(
    agents: AgentMapSource[],
    locations: LocationMapSource[],
    scope: GeoScope | undefined,
    markets: MarketRow[]
  ) {
    return {
      agents: agents.filter((row) => this.addressAllowed(scope, markets, this.agentAddress(row))),
      locations: locations.filter((row) => this.addressAllowed(scope, markets, row.address)),
    };
  }

  private addressAllowed(
    scope: GeoScope | undefined,
    markets: MarketRow[],
    address?: { country?: string | null; state?: string | null } | null
  ): boolean {
    if (!scope || scope.all) return true;
    return scopeCovers(scope, {
      countryCode: address?.country ?? null,
      stateName: address?.state,
    }, markets);
  }

  private agentAddress(agent: AgentMapSource) {
    const rows = (agent.agent_addresses ?? [])
      .map((row) => row.address)
      .filter((address): address is NonNullable<typeof address> => Boolean(address));
    return rows.find((address) => address.is_primary) ?? rows[0] ?? null;
  }

  private regionAllowed(
    scope: GeoScope | undefined,
    code: string,
    stateName: string
  ): boolean {
    if (!scope || scope.all) return true;
    return stateInScope(scope, code, stateName);
  }

}
