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
});

