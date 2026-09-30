import { BadRequestException, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  ADMIN_MAP_AGENTS_QUERY,
  ADMIN_MAP_LOCATIONS_QUERY,
  ADMIN_MAP_REGIONS_QUERY,
} from './admin-map.queries';
import {
  AdminMapFilter,
  AdminMapKind,
  AdminMapPin,
  AgentMapSource,
  LocationMapSource,
} from './admin-map.types';
import { mergePins, normalizeCountryCode, uniqueStateNames } from './admin-map.util';
import { AdminMapPinsQueryDto } from './dto/admin-map-query.dto';

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

  async getPins(query: AdminMapPinsQueryDto): Promise<{ pins: AdminMapPin[] }> {
    const filter = await this.buildFilter(query);
    const [agents, locations] = await this.loadRows(query.kind ?? 'all');
    return { pins: mergePins(agents, locations, filter) };
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

  private loadRows(kind: AdminMapKind) {
    return Promise.all([this.loadAgents(kind), this.loadLocations(kind)]);
  }

  private async loadAgents(kind: AdminMapKind): Promise<AgentMapSource[]> {
    if (kind === 'businesses') return [];
    const data = await this.hasuraSystemService.executeQuery<{
      agents: AgentMapSource[];
    }>(ADMIN_MAP_AGENTS_QUERY);
    return data.agents ?? [];
  }

  private async loadLocations(kind: AdminMapKind): Promise<LocationMapSource[]> {
    if (kind === 'agents') return [];
    const data = await this.hasuraSystemService.executeQuery<{
      business_locations: LocationMapSource[];
    }>(ADMIN_MAP_LOCATIONS_QUERY);
    return data.business_locations ?? [];
  }

  private async loadRegions(code: string): Promise<RegionRow[]> {
    const data = await this.hasuraSystemService.executeQuery<{
      supported_country_states: RegionRow[];
    }>(ADMIN_MAP_REGIONS_QUERY, { code });
    return data.supported_country_states ?? [];
  }
}
