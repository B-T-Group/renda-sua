import type { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import {
  EligibleAgentsQueryService,
  isAgentLocationFresh,
} from './eligible-agents-query.service';

describe('EligibleAgentsQueryService', () => {
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let service: EligibleAgentsQueryService;

  beforeEach(() => {
    hasuraSystemService = {
      executeQuery: jest.fn(),
    } as unknown as jest.Mocked<HasuraSystemService>;
    service = new EligibleAgentsQueryService(
      hasuraSystemService,
      // Fixtures carry region addresses, so reverse-geocode is never called.
      {} as unknown as GoogleDistanceService
    );
  });

  function agentRow(
    agentId: string,
    latitude: number,
    overrides: Record<string, unknown> = {}
  ) {
    return {
      latitude,
      longitude: 9,
      updated_at:
        'updated_at' in overrides
          ? (overrides.updated_at as string | null)
          : new Date().toISOString(),
      agent: {
        id: agentId,
        is_available: overrides.is_available ?? true,
        is_verified: overrides.is_verified ?? true,
        is_internal: overrides.is_internal ?? false,
        focus: (overrides.focus as string) ?? 'both',
        status: overrides.status ?? 'active',
        user: { id: `user-${agentId}` },
        agent_addresses: [
          {
            address: {
              country: (overrides.country as string) ?? 'CM',
              state: (overrides.state as string) ?? 'Littoral',
              is_primary: true,
            },
          },
        ],
      },
    };
  }

  it('filters ineligible agents and sorts by distance', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      agent_locations: [
        agentRow('far', 4.2),
        agentRow('near', 4.01),
        agentRow('unavailable', 4.001, { is_available: false }),
        agentRow('unverified', 4.002, { is_verified: false }),
        agentRow('commercial', 4.0015, { focus: 'commercial' }),
        agentRow('suspended', 4.003, { status: 'suspended' }),
        agentRow('wrong-region', 4.004, { country: 'SN', state: 'Dakar' }),
      ],
    });

    const result = await service.findEligibleAgents({
      originLat: 4,
      originLon: 9,
      targetCountry: 'CM',
      targetState: 'Littoral',
    });

    expect(result.map((c) => c.agentId)).toEqual(['near', 'far']);
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm);
  });

  it('excludes agents outside maxDistanceKm', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      // ~0.09 deg lat ≈ 10 km; ~0.36 deg ≈ 40 km
      agent_locations: [agentRow('near', 4.09), agentRow('far', 4.36)],
    });

    const result = await service.findEligibleAgents({
      originLat: 4,
      originLon: 9,
      targetCountry: 'CM',
      targetState: 'Littoral',
      maxDistanceKm: 20,
    });

    expect(result.map((c) => c.agentId)).toEqual(['near']);
  });

  it('restricts to internal agents when internalOnly is set', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      agent_locations: [
        agentRow('external', 4.01),
        agentRow('internal', 4.02, { is_internal: true }),
      ],
    });

    const result = await service.findEligibleAgents({
      originLat: 4,
      originLon: 9,
      targetCountry: 'CM',
      targetState: 'Littoral',
      internalOnly: true,
    });

    expect(result.map((c) => c.agentId)).toEqual(['internal']);
  });

  it('matches a profile address with accents without calling GPS', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      agent_locations: [
        agentRow('quebec-agent', 4.01, { country: 'CA', state: 'Québec' }),
      ],
    });
    const reverseGeocode = jest.fn();
    service = new EligibleAgentsQueryService(
      hasuraSystemService,
      { reverseGeocode } as unknown as GoogleDistanceService
    );

    const result = await service.findEligibleAgents({
      originLat: 4,
      originLon: 9,
      targetCountry: 'CA',
      targetState: 'Quebec',
    });

    expect(result.map((c) => c.agentId)).toEqual(['quebec-agent']);
    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it('matches via GPS reverse-geocode when the profile address has no state (accents + ISO code)', async () => {
    // Prod repro: address stores country "CA" with an empty state; Google
    // returns "Canada"/"Québec" long names for the agent's GPS position.
    hasuraSystemService.executeQuery.mockResolvedValue({
      agent_locations: [agentRow('quebec-agent', 4.01, { country: 'CA', state: '' })],
    });
    const reverseGeocode = jest.fn().mockResolvedValue({
      country: 'Canada',
      country_code: 'CA',
      state: 'Québec',
    });
    service = new EligibleAgentsQueryService(
      hasuraSystemService,
      { reverseGeocode } as unknown as GoogleDistanceService
    );

    const result = await service.findEligibleAgents({
      originLat: 4,
      originLon: 9,
      targetCountry: 'CA',
      targetState: 'Quebec',
    });

    expect(result.map((c) => c.agentId)).toEqual(['quebec-agent']);
    expect(reverseGeocode).toHaveBeenCalled();
  });

  it('accepts cased/padded focus strings when deciding delivery eligibility', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      agent_locations: [
        agentRow('delivery-cased', 4.01, { focus: ' Delivery ' }),
        agentRow('both-cased', 4.02, { focus: 'BOTH' }),
        agentRow('commercial-cased', 4.015, { focus: 'Commercial' }),
      ],
    });

    const result = await service.findEligibleAgents({
      originLat: 4,
      originLon: 9,
      targetCountry: 'CM',
      targetState: 'Littoral',
    });

    expect(result.map((c) => c.agentId)).toEqual([
      'delivery-cased',
      'both-cased',
    ]);
  });
  describe('GPS last-seen cutoff', () => {
    const minutesAgo = (m: number) =>
      new Date(Date.now() - m * 60 * 1000).toISOString();

    function configWith(agentLocationMaxAgeMinutes: number) {
      return {
        get: jest.fn((key: string) =>
          key === 'deliveryAvailability'
            ? { enforceEnabled: true, agentLocationMaxAgeMinutes }
            : undefined
        ),
      } as unknown as ConfigService<Configuration>;
    }

    it('applies no cutoff by default (config unset)', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agent_locations: [
          agentRow('days-old', 4.01, { updated_at: minutesAgo(3 * 24 * 60) }),
        ],
      });

      const result = await service.findEligibleAgents({
        originLat: 4,
        originLon: 9,
        targetCountry: 'CM',
        targetState: 'Littoral',
      });

      expect(result.map((c) => c.agentId)).toEqual(['days-old']);
    });

    it('excludes agents with no GPS update in the last 30 minutes when configured to 30', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agent_locations: [
          agentRow('fresh', 4.01, { updated_at: minutesAgo(29) }),
          agentRow('stale', 4.005, { updated_at: minutesAgo(31) }),
          agentRow('days-old', 4.002, { updated_at: minutesAgo(3 * 24 * 60) }),
          agentRow('no-timestamp', 4.001, { updated_at: null }),
        ],
      });
      service = new EligibleAgentsQueryService(
        hasuraSystemService,
        {} as unknown as GoogleDistanceService,
        undefined,
        configWith(30)
      );

      const result = await service.findEligibleAgents({
        originLat: 4,
        originLon: 9,
        targetCountry: 'CM',
        targetState: 'Littoral',
      });

      expect(result.map((c) => c.agentId)).toEqual(['fresh']);
    });

    it('reads the cutoff from deliveryAvailability.agentLocationMaxAgeMinutes', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agent_locations: [
          agentRow('ten-min', 4.01, { updated_at: minutesAgo(10) }),
          agentRow('four-min', 4.02, { updated_at: minutesAgo(4) }),
        ],
      });
      service = new EligibleAgentsQueryService(
        hasuraSystemService,
        {} as unknown as GoogleDistanceService,
        undefined,
        configWith(5)
      );

      const result = await service.findEligibleAgents({
        originLat: 4,
        originLon: 9,
        targetCountry: 'CM',
        targetState: 'Littoral',
      });

      expect(result.map((c) => c.agentId)).toEqual(['four-min']);
    });

    it('disables the cutoff when configured to 0', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        agent_locations: [
          agentRow('old', 4.01, { updated_at: minutesAgo(600) }),
        ],
      });
      service = new EligibleAgentsQueryService(
        hasuraSystemService,
        {} as unknown as GoogleDistanceService,
        undefined,
        configWith(0)
      );

      const result = await service.findEligibleAgents({
        originLat: 4,
        originLon: 9,
        targetCountry: 'CM',
        targetState: 'Littoral',
      });

      expect(result.map((c) => c.agentId)).toEqual(['old']);
    });

    it('isAgentLocationFresh treats the boundary as fresh and bad input as stale', () => {
      const now = Date.parse('2026-10-18T12:00:00.000Z');
      expect(isAgentLocationFresh('2026-10-18T11:30:00.000Z', 30, now)).toBe(true);
      expect(isAgentLocationFresh('2026-10-18T11:29:59.000Z', 30, now)).toBe(false);
      expect(isAgentLocationFresh('not-a-date', 30, now)).toBe(false);
      expect(isAgentLocationFresh(undefined, 30, now)).toBe(false);
      expect(isAgentLocationFresh(undefined, 0, now)).toBe(true);
    });
  });
});
