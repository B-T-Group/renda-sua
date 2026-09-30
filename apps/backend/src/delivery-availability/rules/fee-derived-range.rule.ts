import { Injectable } from '@nestjs/common';
import { haversineDistanceKm } from '../../common/agent-proximity.util';
import { DeliveryConfigService } from '../../delivery-configs/delivery-configs.service';
import {
  isBeyondFeeRange,
  maxClientDistanceKm,
  normalizeDeliveryCountryCode,
} from '../../orders/delivery-pricing.util';
import {
  DeliveryAvailabilityContext,
  DeliveryAvailabilityRule,
  DeliveryAvailabilityRuleOutcome,
  DeliveryUnavailableReason,
} from '../delivery-availability.types';

/**
 * Client must be within the distance implied by the country delivery cap:
 * (max fee - normal base) / per km. No separate max-distance config.
 */
@Injectable()
export class FeeDerivedRangeRule implements DeliveryAvailabilityRule {
  readonly id = 'fee-derived-range';
  readonly order = 70;

  constructor(private readonly deliveryConfigService: DeliveryConfigService) {}

  async evaluate(
    ctx: DeliveryAvailabilityContext
  ): Promise<DeliveryAvailabilityRuleOutcome> {
    const distanceKm = this.clientDistanceKm(ctx);
    if (distanceKm == null) return { pass: true };
    const maxClientKm = await this.maxClientKm(ctx.sellerCountry);
    if (!isBeyondFeeRange(distanceKm, maxClientKm)) return { pass: true };
    return {
      pass: false,
      reason: DeliveryUnavailableReason.DELIVERY_RADIUS_EXCEEDED,
      metadata: { maxClientKm, clientDistanceKm: roundKm(distanceKm) },
    };
  }

  private clientDistanceKm(ctx: DeliveryAvailabilityContext): number | null {
    if (
      ctx.pickupLat == null ||
      ctx.pickupLon == null ||
      ctx.deliveryLat == null ||
      ctx.deliveryLon == null
    ) {
      return null;
    }
    return haversineDistanceKm(
      ctx.pickupLat,
      ctx.pickupLon,
      ctx.deliveryLat,
      ctx.deliveryLon
    );
  }

  private async maxClientKm(sellerCountry: string): Promise<number | null> {
    const country = normalizeDeliveryCountryCode(sellerCountry);
    const [normalBase, perKm, maxFee] = await Promise.all([
      this.deliveryConfigService.getNormalDeliveryBaseFee(country),
      this.deliveryConfigService.getPerKmDeliveryFee(country),
      this.deliveryConfigService.getMaxDeliveryFee(country),
    ]);
    return maxClientDistanceKm(normalBase, perKm, maxFee);
  }
}

function roundKm(distanceKm: number): number {
  return Math.round(distanceKm * 100) / 100;
}
