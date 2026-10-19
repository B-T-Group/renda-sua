import { Injectable, Logger, Optional } from '@nestjs/common';
import { DedicatedCoverageService } from '../../dedicated-agents/dedicated-coverage.service';
import { DeliveryConfigService } from '../../delivery-configs/delivery-configs.service';
import { normalizeDeliveryCountryCode } from '../../orders/delivery-pricing.util';
import { emitServerSiteEvent } from '../../site-events/server-site-events.helper';
import { SiteEventsService } from '../../site-events/site-events.service';
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
 *
 * #594 dedicated pass (AC-E1/E2): when nobody is nearby and the request is a
 * scheduled order with a chosen window (`ctx.dedicated`, set only with the
 * flag on), the rule still passes if a dedicated agent can take that slot for
 * this cart (`metadata.coverage='dedicated'`, `coverageSlotKey`). ASAP
 * requests never carry `ctx.dedicated`, so they are unchanged.
 */
@Injectable()
export class AgentInRegionRule implements DeliveryAvailabilityRule {
  readonly id = 'agent-in-region';
  readonly order = 100;
  private readonly logger = new Logger(AgentInRegionRule.name);

  constructor(
    private readonly eligibleAgentsQueryService: EligibleAgentsQueryService,
    private readonly deliveryConfigService: DeliveryConfigService,
    @Optional()
    private readonly dedicatedCoverage?: DedicatedCoverageService,
    @Optional()
    private readonly siteEventsService?: SiteEventsService
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
        normalizeDeliveryCountryCode(ctx.sellerCountry)
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
      const dedicated = await this.dedicatedPass(ctx, radiusKm);
      if (dedicated) return dedicated;
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

  /** Scheduled window covered by a dedicated agent -> pass; anything else (or an error) -> null. */
  private async dedicatedPass(
    ctx: DeliveryAvailabilityContext,
    radiusKm: number
  ): Promise<DeliveryAvailabilityRuleOutcome | null> {
    const request = ctx.dedicated;
    if (!request || !ctx.businessLocationId || !this.dedicatedCoverage) return null;
    try {
      const coverage = await this.dedicatedCoverage.coverWindow({
        locationId: ctx.businessLocationId,
        slotId: request.slotId,
        preferredDate: request.preferredDate,
        rail: request.rail,
        subtotal: request.subtotal,
        currency: request.currency,
        verifiedAgentDelivery: ctx.verifiedAgentDelivery === true,
        now: ctx.evaluatedAt,
      });
      if (!coverage) return null;
      const metadata = {
        radiusKm,
        eligibleAgentCount: 0,
        coverage: 'dedicated',
        coverageSlotKey: coverage.slot.slotKey,
        coverageDate: coverage.slot.date,
        dedicatedAgentCount: coverage.eligible.length,
      };
      emitServerSiteEvent(this.siteEventsService, 'dedicated.coverage_used_at_checkout', {
        businessId: ctx.businessId,
        businessLocationId: ctx.businessLocationId,
        sellerCountry: ctx.sellerCountry,
        sellerState: ctx.sellerState,
        clientId: ctx.clientId ?? null,
        stage: ctx.stage ?? null,
        slotKey: coverage.slot.slotKey,
        slotDate: coverage.slot.date,
        dedicatedAgentCount: coverage.eligible.length,
        internalAgentCount: coverage.eligible.filter((a) => a.isInternal).length,
        rail: request.rail,
      });
      return { pass: true, metadata };
    } catch (error) {
      // Fail closed: no dedicated pass, the usual NO_ELIGIBLE_AGENT outcome.
      this.logger.warn(
        `Dedicated coverage check failed for location ${ctx.businessLocationId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }
}
