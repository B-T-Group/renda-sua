import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import { showsDeliveryChrome } from '../agents/agent-focus.util';
import {
  agentMatchesRegion,
  haversineDistanceKm,
} from '../common/agent-proximity.util';
import type { Configuration } from '../config/configuration';
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

/** Default GPS last-seen cutoff when config is unavailable. */
export const DEFAULT_AGENT_LOCATION_MAX_AGE_MINUTES = 30;

/**
 * True when the agent's last GPS update is recent enough to trust. A
 * missing or unparseable timestamp counts as stale. `maxAgeMinutes <= 0`
 * disables the cutoff.
 */
export function isAgentLocationFresh(
  updatedAt: string | null | undefined,
  maxAgeMinutes: number,
  nowMs: number = Date.now()
): boolean {
  if (!(maxAgeMinutes > 0)) return true;
  if (!updatedAt) return false;
  const updatedMs = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedMs)) return false;
  return nowMs - updatedMs <= maxAgeMinutes * 60 * 1000;
}

interface EligibleAgentRow {
  latitude: number | string;
  longitude: number | string;
  updated_at?: string | null;
  agent: {
    id: string;
    is_available: boolean;
    is_verified: boolean;
    is_internal: boolean;
    focus?: string | null;
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
      updated_at
      agent {
        id
        is_available
        is_verified
        is_internal
        focus
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
 * Eligibility: agent is available, verified, delivery-focused (not
 * commercial-only), not suspended, has a GPS update within
 * `deliveryAvailability.agentLocationMaxAgeMinutes` (default 30), and
 * operates in the target country/state (profile address, falling back to
 * GPS reverse-geocode).
 */
@Injectable()
export class EligibleAgentsQueryService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly googleDistanceService: GoogleDistanceService,
    @Optional() private readonly agentContractGate?: AgentContractGateService,
    @Optional()
    private readonly configService?: ConfigService<Configuration>
  ) {}

  private get locationMaxAgeMinutes(): number {
    const value = this.configService?.get('deliveryAvailability')
      ?.agentLocationMaxAgeMinutes;
    return typeof value === 'number' && value >= 0
      ? value
      : DEFAULT_AGENT_LOCATION_MAX_AGE_MINUTES;
  }

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
    const maxAgeMinutes = this.locationMaxAgeMinutes;
    const nowMs = Date.now();
    const rows = (await this.fetchAgentLocations()).filter((row) =>
      isAgentLocationFresh(row.updated_at, maxAgeMinutes, nowMs)
    );
    const signedIds = await this.agentContractGate?.signedIdsOrSkip(
      rows.map((row) => row.agent?.id).filter((id): id is string => !!id)
    );

    const candidates: EligibleAgentCandidate[] = [];
    for (const row of rows) {
      const agent = row.agent;
      if (!agent) continue;
      if (!agent.is_available || !agent.is_verified) continue;
      if (!showsDeliveryChrome(agent.focus)) continue;
      if (agent.status === 'suspended') continue;
      if (signedIds && !signedIds.has(agent.id)) continue;
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
          // Prefer the ISO-2 code — addresses store "CA"/"CM", not "Canada".
          return { country: geo.country_code || geo.country, state: geo.state };
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
