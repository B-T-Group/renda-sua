/**
 * Client-side delivery estimate adapter (Phase 1).
 * 
 * Provides conservative estimates for PDP Delivery Expectations Card.
 * Phase 2 will replace this with backend GET /api/delivery/estimate.
 */

export type DeliveryCategory = 'store' | 'food' | 'rental';

export type DeliveryCoverage = 'covered' | 'needs_finer_area' | 'out_of_coverage';

export type ServingStatus = 'available' | 'closed' | 'sold_out' | null;

export interface DeliveryFeeEstimate {
  currency: 'XAF' | 'NGN';
  min: number | null;
  max: number | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface DeliveryTimeWindow {
  label: string;
  minHours: number | null;
  maxHours: number | null;
}

export interface DeliveryEstimate {
  areaLabel: string;
  needsFinerArea: boolean;
  window: DeliveryTimeWindow | null;
  fee: DeliveryFeeEstimate | null;
  servingStatus: ServingStatus;
  coverage: DeliveryCoverage;
  trustVariant: 'map_pin' | 'standard' | null;
}

export interface GetDeliveryEstimateParams {
  category: DeliveryCategory;
  market: string;
  area: string | null;
  businessLocationId?: string;
  foodAvailability?: {
    is_available: boolean;
    is_sold_out: boolean;
    has_schedule: boolean;
  } | null;
}

/**
 * Phase 1: Client-side conservative estimates.
 * Store: 24–48h bands, NEVER minute ETAs for unassigned Store.
 * Food: Respect serving hours from foodAvailability.
 * Rentals: Business-operated pickup/drop-off messaging.
 */
export function getDeliveryEstimate(
  params: GetDeliveryEstimateParams
): DeliveryEstimate {
  const { category, market, area, foodAvailability } = params;

  const currency = market.toUpperCase() === 'CM' ? 'XAF' : market.toUpperCase() === 'NG' ? 'NGN' : 'XAF';
  const areaLabel = area || 'All';
  const needsFinerArea = !area || area.toLowerCase() === 'all';

  if (category === 'food') {
    const serving = resolveFoodServingStatus(foodAvailability);
    
    if (serving !== 'available') {
      return {
        areaLabel,
        needsFinerArea,
        window: null,
        fee: needsFinerArea ? null : { currency, min: null, max: null, confidence: 'low' },
        servingStatus: serving,
        coverage: 'covered',
        trustVariant: null,
      };
    }

    return {
      areaLabel,
      needsFinerArea,
      window: {
        label: 'Ready in 45–75 min',
        minHours: null,
        maxHours: null,
      },
      fee: needsFinerArea
        ? null
        : {
            currency,
            min: currency === 'XAF' ? 500 : 200,
            max: currency === 'XAF' ? 1200 : 500,
            confidence: 'low',
          },
      servingStatus: 'available',
      coverage: needsFinerArea ? 'needs_finer_area' : 'covered',
      trustVariant: needsFinerArea ? null : 'map_pin',
    };
  }

  if (category === 'rental') {
    return {
      areaLabel,
      needsFinerArea,
      window: {
        label: 'Pickup/drop-off arranged',
        minHours: null,
        maxHours: null,
      },
      fee: needsFinerArea
        ? null
        : {
            currency,
            min: null,
            max: null,
            confidence: 'low',
          },
      servingStatus: null,
      coverage: needsFinerArea ? 'needs_finer_area' : 'covered',
      trustVariant: needsFinerArea ? null : 'standard',
    };
  }

  // Store category: conservative 24–48h bands, NEVER minutes for unassigned orders
  return {
    areaLabel,
    needsFinerArea,
    window: {
      label: 'Usually arrives in 24–48 hours',
      minHours: 24,
      maxHours: 48,
    },
    fee: needsFinerArea
      ? null
      : {
          currency,
          min: currency === 'XAF' ? 500 : 200,
          max: currency === 'XAF' ? 1200 : 500,
          confidence: 'medium',
        },
    servingStatus: null,
    coverage: needsFinerArea ? 'needs_finer_area' : 'covered',
    trustVariant: needsFinerArea ? null : 'map_pin',
  };
}

function resolveFoodServingStatus(
  foodAvailability: GetDeliveryEstimateParams['foodAvailability']
): ServingStatus {
  if (!foodAvailability) return 'available';
  if (foodAvailability.is_sold_out) return 'sold_out';
  if (!foodAvailability.is_available) return 'closed';
  return 'available';
}
