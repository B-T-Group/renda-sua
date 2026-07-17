import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DELIVERY_AVAILABILITY_RULES,
  DeliveryAvailabilityContext,
  DeliveryAvailabilityResult,
  DeliveryAvailabilityRule,
  DeliveryUnavailableReason,
} from './delivery-availability.types';

/**
 * Single source of truth for whether delivery can be offered for an order
 * context. Runs the registered availability rules in ascending `order` and
 * short-circuits on the first failure.
 *
 * Callers (checkout preflight, order create) must only surface the boolean
 * to clients; the internal reason is for logging and analytics.
 */
@Injectable()
export class DeliveryAvailabilityService {
  private readonly logger = new Logger(DeliveryAvailabilityService.name);
  private readonly rules: DeliveryAvailabilityRule[];

  constructor(
    @Optional()
    @Inject(DELIVERY_AVAILABILITY_RULES)
    rules: DeliveryAvailabilityRule[] | null
  ) {
    this.rules = [...(rules ?? [])].sort((a, b) => a.order - b.order);
  }

  async evaluate(
    ctx: DeliveryAvailabilityContext
  ): Promise<DeliveryAvailabilityResult> {
    const startedAt = Date.now();
    try {
      let estimatedDeliveryMinutes: number | null = null;
      const passMetadata: Record<string, unknown> = {};

      for (const rule of this.rules) {
        const outcome = await rule.evaluate(ctx);
        if (!outcome.pass) {
          const result: DeliveryAvailabilityResult = {
            available: false,
            estimatedDeliveryMinutes: null,
            reason: outcome.reason,
            ruleId: rule.id,
            metadata: { ...passMetadata, ...outcome.metadata },
          };
          this.logEvaluation(ctx, result, Date.now() - startedAt);
          return result;
        }
        if (outcome.metadata) {
          Object.assign(passMetadata, outcome.metadata);
        }
        if (
          estimatedDeliveryMinutes == null &&
          outcome.estimatedDeliveryMinutes != null
        ) {
          estimatedDeliveryMinutes = outcome.estimatedDeliveryMinutes;
        }
      }

      const result: DeliveryAvailabilityResult = {
        available: true,
        estimatedDeliveryMinutes,
        reason: null,
        ruleId: null,
        metadata: passMetadata,
      };
      this.logEvaluation(ctx, result, Date.now() - startedAt);
      return result;
    } catch (error: any) {
      // Fail-safe: prefer blocking delivery over creating undeliverable
      // orders. Pickup remains independently available.
      this.logger.error(
        `Delivery availability evaluation failed for business ${ctx.businessId}: ${error?.message}`
      );
      const result: DeliveryAvailabilityResult = {
        available: false,
        estimatedDeliveryMinutes: null,
        reason: DeliveryUnavailableReason.EVALUATION_ERROR,
        ruleId: null,
      };
      this.logEvaluation(ctx, result, Date.now() - startedAt);
      return result;
    }
  }

  private logEvaluation(
    ctx: DeliveryAvailabilityContext,
    result: DeliveryAvailabilityResult,
    durationMs: number
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'delivery_availability.evaluated',
        businessId: ctx.businessId,
        sellerCountry: ctx.sellerCountry,
        sellerState: ctx.sellerState,
        clientId: ctx.clientId ?? null,
        available: result.available,
        reason: result.reason,
        ruleId: result.ruleId,
        metadata: result.metadata ?? null,
        durationMs,
      })
    );
  }
}
