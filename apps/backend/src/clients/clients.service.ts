import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  addressesMatchRegion,
  haversineDistanceKm,
} from '../common/agent-proximity.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { resolveActivePersonaWithDefault } from '../users/persona.util';

const MAX_NEARBY_AGENTS = 10;

interface ClientCoords {
  latitude: number;
  longitude: number;
  country: string;
  state: string;
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
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  /**
   * Number of available agents in the client's region, capped to the closest
   * `MAX_NEARBY_AGENTS` by Haversine distance from the client's primary address.
   */
  async getNearbyAgentsCount(): Promise<{ count: number }> {
    const coords = await this.resolveClientCoords();
    if (!coords) return { count: 0 };

    const rows = await this.fetchAgentLocations();
    const distances = this.eligibleDistances(rows, coords);
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

  private toCoords(addresses: any[] | undefined): ClientCoords | null {
    const list = addresses ?? [];
    const primary = list.find((a) => a?.is_primary) ?? list[0];
    if (
      !primary?.latitude ||
      !primary?.longitude ||
      !primary?.country ||
      !primary?.state
    ) {
      return null;
    }
    return {
      latitude: Number(primary.latitude),
      longitude: Number(primary.longitude),
      country: primary.country,
      state: primary.state,
    };
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

  private eligibleDistances(
    rows: NearbyAgentRow[],
    coords: ClientCoords
  ): number[] {
    const distances: number[] = [];
    for (const row of rows) {
      const agent = row.agent;
      if (!agent) continue;
      if (!agent.is_available || !agent.is_verified) continue;
      if (agent.status === 'suspended') continue;
      if (
        !addressesMatchRegion(agent.agent_addresses, coords.country, coords.state)
      ) {
        continue;
      }
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
