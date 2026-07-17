import type { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { EligibleAgentsQueryService } from './eligible-agents-query.service';

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
      agent: {
        id: agentId,
        is_available: overrides.is_available ?? true,
        is_verified: overrides.is_verified ?? true,
        is_internal: overrides.is_internal ?? false,
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
});
