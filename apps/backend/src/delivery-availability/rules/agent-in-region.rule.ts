import { Injectable } from '@nestjs/common';
import { DeliveryConfigService } from '../../delivery-configs/delivery-configs.service';
import { EligibleAgentsQueryService } from '../eligible-agents-query.service';
import {
  DeliveryAvailabilityContext,
  DeliveryAvailabilityRule,
  DeliveryAvailabilityRuleOutcome,
  DeliveryUnavailableReason,
} from '../delivery-availability.types';

/**
 * Delivery is available only when at least one eligible agent (available,
 * verified, not suspended, operating in the seller's country/state) is within
 * the configured `delivery_availability_radius_km` of the business pickup
 * location. Mirrors the eligibility used by order offer fan-out so we never
 * promise delivery that no agent would be offered.
 */
@Injectable()
export class AgentInRegionRule implements DeliveryAvailabilityRule {
  readonly id = 'agent-in-region';
  readonly order = 100;

  constructor(
    private readonly eligibleAgentsQueryService: EligibleAgentsQueryService,
    private readonly deliveryConfigService: DeliveryConfigService
  ) {}

  async evaluate(
    ctx: DeliveryAvailabilityContext
  ): Promise<DeliveryAvailabilityRuleOutcome> {
    if (ctx.pickupLat == null || ctx.pickupLon == null) {
      return {
        pass: false,
        reason: DeliveryUnavailableReason.MISSING_PICKUP_COORDS,
        metadata: { businessId: ctx.businessId },
      };
    }

    const radiusKm =
      await this.deliveryConfigService.getDeliveryAvailabilityRadiusKm(
        ctx.sellerCountry
      );

    const candidates =
      await this.eligibleAgentsQueryService.findEligibleAgents({
        originLat: ctx.pickupLat,
        originLon: ctx.pickupLon,
        targetCountry: ctx.sellerCountry,
        targetState: ctx.sellerState,
        internalOnly: ctx.verifiedAgentDelivery,
        maxDistanceKm: radiusKm,
      });

    if (candidates.length === 0) {
      return {
        pass: false,
        reason: DeliveryUnavailableReason.NO_ELIGIBLE_AGENT,
        metadata: { radiusKm, eligibleAgentCount: 0 },
      };
    }

    return {
      pass: true,
      metadata: {
        radiusKm,
        eligibleAgentCount: candidates.length,
        nearestDistanceKm: Math.round(candidates[0].distanceKm * 100) / 100,
      },
    };
  }
}
