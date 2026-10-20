import { DeliveryConfigService } from '../../delivery-configs/delivery-configs.service';
import {
  EligibleAgentsQueryService,
} from '../eligible-agents-query.service';
import {
  DeliveryAvailabilityContext,
  DeliveryUnavailableReason,
} from '../delivery-availability.types';
import type { DedicatedCoverageService } from '../../dedicated-agents/dedicated-coverage.service';
import type { SiteEventsService } from '../../site-events/site-events.service';
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

  describe('#594 dedicated pass for scheduled windows', () => {
    const dedicated = {
      slotId: 'slot-a',
      preferredDate: '2026-10-20',
      rail: 'mobile_money' as const,
      subtotal: 8000,
      currency: 'XAF',
    };
    const scheduledCtx: DeliveryAvailabilityContext = {
      ...ctx,
      businessLocationId: 'loc-1',
      clientId: 'client-1',
      stage: 'place_order',
      dedicated,
    };
    const covered = {
      slot: { slotKey: 'afternoon', slotId: 'slot-a', startTime: '12:00', endTime: '16:00', date: '2026-10-20', timeZone: 'Africa/Douala' },
      eligible: [
        { agentId: 'int', userId: 'u1', assignmentId: 'as1', isInternal: true, activeOrders: 0, outstandingDedicatedOffers: 0, holdAmount: 0, availableBalance: null },
        { agentId: 'ind', userId: 'u2', assignmentId: 'as2', isInternal: false, activeOrders: 1, outstandingDedicatedOffers: 0, holdAmount: 6400, availableBalance: 7000 },
      ],
    };
    let coverWindow: jest.Mock;
    let trackEvent: jest.Mock;

    beforeEach(() => {
      coverWindow = jest.fn().mockResolvedValue(covered);
      trackEvent = jest.fn().mockResolvedValue(undefined);
      rule = new AgentInRegionRule(
        eligibleAgentsQueryService,
        deliveryConfigService,
        { coverWindow } as unknown as DedicatedCoverageService,
        { trackEvent } as unknown as SiteEventsService
      );
      eligibleAgentsQueryService.findEligibleAgents.mockResolvedValue([]);
    });

    it('no agent nearby but a dedicated agent covers the chosen slot -> pass, coverage=dedicated', async () => {
      const outcome = await rule.evaluate({ ...scheduledCtx, verifiedAgentDelivery: true });

      expect(outcome).toEqual({
        pass: true,
        metadata: {
          radiusKm: 20,
          eligibleAgentCount: 0,
          coverage: 'dedicated',
          coverageSlotKey: 'afternoon',
          coverageDate: '2026-10-20',
          dedicatedAgentCount: 2,
        },
      });
      expect(coverWindow).toHaveBeenCalledWith({
        locationId: 'loc-1',
        slotId: 'slot-a',
        preferredDate: '2026-10-20',
        rail: 'mobile_money',
        subtotal: 8000,
        currency: 'XAF',
        verifiedAgentDelivery: true,
        now: ctx.evaluatedAt,
      });
    });

    it('emits dedicated.coverage_used_at_checkout with the slot and agent counts', async () => {
      await rule.evaluate(scheduledCtx);

      expect(trackEvent).toHaveBeenCalledTimes(1);
      expect(trackEvent.mock.calls[0][0]).toMatchObject({
        eventType: 'dedicated.coverage_used_at_checkout',
        metadata: {
          businessId: 'business-1',
          businessLocationId: 'loc-1',
          clientId: 'client-1',
          stage: 'place_order',
          slotKey: 'afternoon',
          slotDate: '2026-10-20',
          dedicatedAgentCount: 2,
          internalAgentCount: 1,
          rail: 'mobile_money',
        },
      });
    });

    it('slot not covered -> NO_ELIGIBLE_AGENT as today, no event', async () => {
      coverWindow.mockResolvedValue(null);

      const outcome = await rule.evaluate(scheduledCtx);

      expect(outcome).toEqual({
        pass: false,
        reason: DeliveryUnavailableReason.NO_ELIGIBLE_AGENT,
        metadata: { radiusKm: 20, eligibleAgentCount: 0 },
      });
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('ASAP request (no ctx.dedicated) never asks for dedicated coverage', async () => {
      const outcome = await rule.evaluate({ ...scheduledCtx, dedicated: undefined });

      expect(outcome).toMatchObject({ pass: false, reason: DeliveryUnavailableReason.NO_ELIGIBLE_AGENT });
      expect(coverWindow).not.toHaveBeenCalled();
    });

    it('agent nearby -> normal pass, dedicated coverage not consulted', async () => {
      eligibleAgentsQueryService.findEligibleAgents.mockResolvedValue([
        { agentId: 'agent-1', userId: 'user-1', isInternal: false, distanceKm: 2 },
      ]);

      const outcome = await rule.evaluate(scheduledCtx);

      expect(outcome).toEqual({
        pass: true,
        metadata: { radiusKm: 20, eligibleAgentCount: 1, nearestDistanceKm: 2 },
      });
      expect(coverWindow).not.toHaveBeenCalled();
    });

    it('no location id -> no dedicated pass', async () => {
      const outcome = await rule.evaluate({ ...scheduledCtx, businessLocationId: undefined });

      expect(outcome).toMatchObject({ pass: false });
      expect(coverWindow).not.toHaveBeenCalled();
    });

    it('coverage lookup error fails closed (NO_ELIGIBLE_AGENT)', async () => {
      coverWindow.mockRejectedValue(new Error('hasura down'));

      const outcome = await rule.evaluate(scheduledCtx);

      expect(outcome).toMatchObject({ pass: false, reason: DeliveryUnavailableReason.NO_ELIGIBLE_AGENT });
    });

    it('missing pickup coordinates still fail before any dedicated check', async () => {
      const outcome = await rule.evaluate({ ...scheduledCtx, pickupLat: null });

      expect(outcome).toMatchObject({ pass: false, reason: DeliveryUnavailableReason.MISSING_PICKUP_COORDS });
      expect(coverWindow).not.toHaveBeenCalled();
    });
  });
});
