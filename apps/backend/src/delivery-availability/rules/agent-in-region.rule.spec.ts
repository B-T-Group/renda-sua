import { DeliveryConfigService } from '../../delivery-configs/delivery-configs.service';
import {
  EligibleAgentsQueryService,
} from '../eligible-agents-query.service';
import {
  DeliveryAvailabilityContext,
  DeliveryUnavailableReason,
} from '../delivery-availability.types';
import { AgentInRegionRule } from './agent-in-region.rule';

describe('AgentInRegionRule', () => {
  let eligibleAgentsQueryService: jest.Mocked<EligibleAgentsQueryService>;
  let deliveryConfigService: jest.Mocked<DeliveryConfigService>;
  let rule: AgentInRegionRule;

  const ctx: DeliveryAvailabilityContext = {
    businessId: 'business-1',
    sellerCountry: 'CM',
    sellerState: 'Littoral',
    pickupLat: 4,
    pickupLon: 9,
    evaluatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    eligibleAgentsQueryService = {
      findEligibleAgents: jest.fn(),
    } as unknown as jest.Mocked<EligibleAgentsQueryService>;
    deliveryConfigService = {
      getDeliveryAvailabilityRadiusKm: jest.fn().mockResolvedValue(20),
    } as unknown as jest.Mocked<DeliveryConfigService>;
    rule = new AgentInRegionRule(
      eligibleAgentsQueryService,
      deliveryConfigService
    );
  });

  it('fails with MISSING_PICKUP_COORDS when the business has no coordinates', async () => {
    const outcome = await rule.evaluate({ ...ctx, pickupLat: null });

    expect(outcome).toEqual({
      pass: false,
      reason: DeliveryUnavailableReason.MISSING_PICKUP_COORDS,
      metadata: { businessId: 'business-1' },
    });
    expect(eligibleAgentsQueryService.findEligibleAgents).not.toHaveBeenCalled();
  });

  it('passes when an eligible agent is inside the configured radius', async () => {
    eligibleAgentsQueryService.findEligibleAgents.mockResolvedValue([
      { agentId: 'agent-1', userId: 'user-1', isInternal: false, distanceKm: 5 },
    ]);

    const outcome = await rule.evaluate(ctx);

    expect(outcome).toEqual({
      pass: true,
      metadata: { radiusKm: 20, eligibleAgentCount: 1, nearestDistanceKm: 5 },
    });
    expect(eligibleAgentsQueryService.findEligibleAgents).toHaveBeenCalledWith({
      originLat: 4,
      originLon: 9,
      targetCountry: 'CM',
      targetState: 'Littoral',
      internalOnly: undefined,
      maxDistanceKm: 20,
    });
  });

  it('fails with NO_ELIGIBLE_AGENT when no agent is within the radius', async () => {
    eligibleAgentsQueryService.findEligibleAgents.mockResolvedValue([]);

    const outcome = await rule.evaluate(ctx);

    expect(outcome).toEqual({
      pass: false,
      reason: DeliveryUnavailableReason.NO_ELIGIBLE_AGENT,
      metadata: { radiusKm: 20, eligibleAgentCount: 0 },
    });
  });

  it('restricts to internal agents for verified-agent deliveries', async () => {
    eligibleAgentsQueryService.findEligibleAgents.mockResolvedValue([
      { agentId: 'agent-1', userId: 'user-1', isInternal: true, distanceKm: 3 },
    ]);

    await rule.evaluate({ ...ctx, verifiedAgentDelivery: true });

    expect(eligibleAgentsQueryService.findEligibleAgents).toHaveBeenCalledWith(
      expect.objectContaining({ internalOnly: true })
    );
  });
});
