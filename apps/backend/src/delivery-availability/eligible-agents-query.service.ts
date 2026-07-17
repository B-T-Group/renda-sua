import { Injectable } from '@nestjs/common';
import {
  agentMatchesRegion,
  haversineDistanceKm,
} from '../common/agent-proximity.util';
import { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface EligibleAgentCandidate {
  agentId: string;
  userId: string | null;
  isInternal: boolean;
  distanceKm: number;
}

export interface EligibleAgentSearchParams {
  /** Origin the distance is measured from (business pickup or client address). */
  originLat: number;
  originLon: number;
  /** Region the agent must operate in (profile address or GPS reverse-geocode). */
  targetCountry: string;
  targetState: string;
  /** Restrict to internal agents (verified_agent_delivery orders). */
  internalOnly?: boolean;
  /** Exclude agents further than this Haversine distance. Null/undefined = no cap. */
  maxDistanceKm?: number | null;
}

interface EligibleAgentRow {
  latitude: number | string;
  longitude: number | string;
  agent: {
    id: string;
    is_available: boolean;
    is_verified: boolean;
    is_internal: boolean;
    status: string;
    user: { id: string } | null;
    agent_addresses: Array<{
      address: {
        country?: string | null;
        state?: string | null;
        is_primary?: boolean | null;
      } | null;
    }>;
  } | null;
}

const ELIGIBLE_AGENTS_QUERY = `
  query EligibleAgents {
    agent_locations {
      latitude
      longitude
      agent {
        id
        is_available
        is_verified
        is_internal
        status
        user {
          id
        }
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

/**
 * Single source of truth for "which delivery agents are eligible near a
 * point". Shared by the client nearby-agents badge, order offer fan-out, and
 * the delivery availability rules so eligibility filters never diverge.
 *
 * Eligibility: agent is available, verified, not suspended, and operates in
 * the target country/state (profile address, falling back to GPS
 * reverse-geocode).
 */
@Injectable()
export class EligibleAgentsQueryService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly googleDistanceService: GoogleDistanceService
  ) {}

  /**
   * Returns eligible agents sorted by ascending Haversine distance from the
   * origin, optionally capped to `maxDistanceKm`.
   *
   * TODO(PostGIS): replace this full-table `agent_locations` load +
   * in-memory Haversine filter with a PostGIS `geography` column and an
   * indexed `ST_DWithin` radius query once agent volume makes the scan
   * expensive.
   */
  async findEligibleAgents(
    params: EligibleAgentSearchParams
  ): Promise<EligibleAgentCandidate[]> {
    const rows = await this.fetchAgentLocations();

    const candidates: EligibleAgentCandidate[] = [];
    for (const row of rows) {
      const agent = row.agent;
      if (!agent) continue;
      if (!agent.is_available || !agent.is_verified) continue;
      if (agent.status === 'suspended') continue;
      if (params.internalOnly && !agent.is_internal) continue;

      const matches = await agentMatchesRegion({
        agentAddresses: agent.agent_addresses,
        agentLocation: {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        },
        targetCountry: params.targetCountry,
        targetState: params.targetState,
        reverseGeocode: async (lat, lng) => {
          const geo = await this.googleDistanceService.reverseGeocode(lat, lng);
          return { country: geo.country, state: geo.state };
        },
      });
      if (!matches) continue;

      const distanceKm = haversineDistanceKm(
        params.originLat,
        params.originLon,
        Number(row.latitude),
        Number(row.longitude)
      );
      if (params.maxDistanceKm != null && distanceKm > params.maxDistanceKm) {
        continue;
      }

      candidates.push({
        agentId: agent.id,
        userId: agent.user?.id ?? null,
        isInternal: !!agent.is_internal,
        distanceKm,
      });
    }

    candidates.sort((a, b) => a.distanceKm - b.distanceKm);
    return candidates;
  }

  private async fetchAgentLocations(): Promise<EligibleAgentRow[]> {
    const result = await this.hasuraSystemService.executeQuery(
      ELIGIBLE_AGENTS_QUERY,
      {}
    );
    return (result?.agent_locations as EligibleAgentRow[]) ?? [];
  }
}
