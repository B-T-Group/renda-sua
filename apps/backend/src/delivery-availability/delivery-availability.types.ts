/**
 * Internal reason a delivery availability rule failed. NEVER sent to clients:
 * customers always see the fixed "Delivery is currently unavailable." copy.
 * Reasons exist for logging, analytics, and internal workflows only.
 */
export enum DeliveryUnavailableReason {
  NO_ELIGIBLE_AGENT = 'NO_ELIGIBLE_AGENT',
  DELIVERY_RADIUS_EXCEEDED = 'DELIVERY_RADIUS_EXCEEDED',
  MERCHANT_DELIVERY_PAUSED = 'MERCHANT_DELIVERY_PAUSED',
  MERCHANT_CLOSED = 'MERCHANT_CLOSED',
  CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
  SERVICE_AREA_DISABLED = 'SERVICE_AREA_DISABLED',
  MISSING_PICKUP_COORDS = 'MISSING_PICKUP_COORDS',
  EVALUATION_ERROR = 'EVALUATION_ERROR',
}

/** Everything a rule may need to decide whether delivery can be offered. */
export interface DeliveryAvailabilityContext {
  businessId: string;
  businessLocationId?: string;
  sellerCountry: string;
  sellerState: string;
  /** Business pickup coordinates — the anchor for agent proximity. */
  pickupLat: number | null;
  pickupLon: number | null;
  deliveryAddressId?: string;
  deliveryLat?: number | null;
  deliveryLon?: number | null;
  deliveryCountry?: string;
  deliveryState?: string;
  itemIds?: string[];
  inventoryIds?: string[];
  requiresFastDelivery?: boolean;
  verifiedAgentDelivery?: boolean;
  clientId?: string;
  evaluatedAt: Date;
}

/** Internal evaluation result (service + logs). */
export interface DeliveryAvailabilityResult {
  available: boolean;
  estimatedDeliveryMinutes: number | null;
  /** Internal only — never returned to API clients. */
  reason: DeliveryUnavailableReason | null;
  /** Id of the rule that failed, for analytics. */
  ruleId: string | null;
  metadata?: Record<string, unknown>;
}

/** Client-safe shape. Intentionally carries no reason. */
export interface DeliveryAvailabilityPublicDto {
  available: boolean;
  estimated_delivery_minutes: number | null;
}

export type DeliveryAvailabilityRuleOutcome =
  | {
      pass: true;
      estimatedDeliveryMinutes?: number | null;
      /** Analytics-only details (e.g. eligibleAgentCount, nearestDistanceKm). */
      metadata?: Record<string, unknown>;
    }
  | {
      pass: false;
      reason: DeliveryUnavailableReason;
      metadata?: Record<string, unknown>;
    };

/**
 * A single availability rule (Specification pattern). Rules are registered on
 * the DELIVERY_AVAILABILITY_RULES multi-provider token and evaluated in
 * ascending `order`; the first failing rule short-circuits the evaluation.
 */
export interface DeliveryAvailabilityRule {
  readonly id: string;
  /** Lower runs first. */
  readonly order: number;
  evaluate(
    ctx: DeliveryAvailabilityContext
  ): Promise<DeliveryAvailabilityRuleOutcome>;
}

export const DELIVERY_AVAILABILITY_RULES = Symbol(
  'DELIVERY_AVAILABILITY_RULES'
);

export function toPublicDeliveryAvailability(
  result: DeliveryAvailabilityResult
): DeliveryAvailabilityPublicDto {
  return {
    available: result.available,
    estimated_delivery_minutes: result.estimatedDeliveryMinutes,
  };
}
