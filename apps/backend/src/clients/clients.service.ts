import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  agentMatchesRegion,
  haversineDistanceKm,
} from '../common/agent-proximity.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { GoogleDistanceService } from '../google/google-distance.service';
import { LocationsService } from '../locations/locations.service';
import { resolveActivePersonaWithDefault } from '../users/persona.util';

const MAX_NEARBY_AGENTS = 10;

interface ClientCoords {
  latitude: number;
  longitude: number;
  country: string;
  state: string;
}

interface ClientAddress {
  id?: string | null;
  address_line_1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  is_primary?: boolean | null;
}

interface NearbyAgentRow {
  latitude: number | string;
  longitude: number | string;
  agent: {
    is_available: boolean;
    is_verified: boolean;
    status: string;
    agent_addresses: Array<{
      address: {
        country?: string | null;
        state?: string | null;
        is_primary?: boolean | null;
      } | null;
    }>;
  } | null;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly locationsService: LocationsService,
    private readonly googleDistanceService: GoogleDistanceService
  ) {}

  /**
   * Number of available agents in the client's region, capped to the closest
   * `MAX_NEARBY_AGENTS` by Haversine distance from the client's primary address.
   */
  async getNearbyAgentsCount(): Promise<{ count: number }> {
    const coords = await this.resolveClientCoords();
    if (!coords) return { count: 0 };

    const rows = await this.fetchAgentLocations();
    const distances = await this.eligibleDistances(rows, coords);
    distances.sort((a, b) => a - b);
    return { count: Math.min(distances.length, MAX_NEARBY_AGENTS) };
  }

  private async resolveClientCoords(): Promise<ClientCoords | null> {
    const user = await this.hasuraUserService.getUser();
    const active = resolveActivePersonaWithDefault(
      user,
      this.hasuraUserService.getActivePersonaHeader()
    );
    if (active !== 'client') {
      throw new HttpException(
        'Only clients can view nearby agents',
        HttpStatus.FORBIDDEN
      );
    }
    if (!user.client?.id) {
      throw new HttpException(
        'Client profile is missing',
        HttpStatus.FORBIDDEN
      );
    }
    return this.toCoords(user.addresses);
  }

  private async toCoords(
    addresses: ClientAddress[] | undefined
  ): Promise<ClientCoords | null> {
    const list = addresses ?? [];
    const primary = list.find((a) => a?.is_primary) ?? list[0];
    if (!primary?.country || !primary?.state) {
      return null;
    }

    const coords = await this.resolvePrimaryCoordinates(primary);
    if (!coords) {
      return null;
    }

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      country: primary.country,
      state: primary.state,
    };
  }

  /**
   * Returns the primary address coordinates, geocoding and persisting them when
   * they are missing but the full street address is available.
   */
  private async resolvePrimaryCoordinates(
    primary: ClientAddress
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (primary.latitude && primary.longitude) {
      return {
        latitude: Number(primary.latitude),
        longitude: Number(primary.longitude),
      };
    }
    if (!primary.id || !this.hasGeocodableAddress(primary)) {
      return null;
    }
    return this.locationsService.ensureAddressHasCoordinates(
      primary.id,
      primary
    );
  }

  private hasGeocodableAddress(address: ClientAddress): boolean {
    return Boolean(
      address?.address_line_1 &&
        address?.city &&
        address?.state &&
        address?.country &&
        address?.postal_code
    );
  }

  private async fetchAgentLocations(): Promise<NearbyAgentRow[]> {
    const query = `
      query NearbyAgents {
        agent_locations {
          latitude
          longitude
          agent {
            is_available
            is_verified
            status
            agent_addresses(where: { address: { status: { _eq: active } } }) {
              address {
                country
                state
                is_primary
              }
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {});
    return (result?.agent_locations as NearbyAgentRow[]) ?? [];
  }

  private async eligibleDistances(
    rows: NearbyAgentRow[],
    coords: ClientCoords
  ): Promise<number[]> {
    const distances: number[] = [];
    const reverseGeocode = async (lat: number, lng: number) => {
      const geo = await this.googleDistanceService.reverseGeocode(lat, lng);
      return { country: geo.country, state: geo.state };
    };
    for (const row of rows) {
      const agent = row.agent;
      if (!agent) continue;
      if (!agent.is_available || !agent.is_verified) continue;
      if (agent.status === 'suspended') continue;
      const matches = await agentMatchesRegion({
        agentAddresses: agent.agent_addresses,
        agentLocation: {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        },
        targetCountry: coords.country,
        targetState: coords.state,
        reverseGeocode,
      });
      if (!matches) continue;
      distances.push(
        haversineDistanceKm(
          coords.latitude,
          coords.longitude,
          Number(row.latitude),
          Number(row.longitude)
        )
      );
    }
    return distances;
  }
}
