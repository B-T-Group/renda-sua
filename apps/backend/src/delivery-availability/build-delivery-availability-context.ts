import { normalizeDeliveryCountryCode } from '../orders/delivery-pricing.util';
import { DeliveryAvailabilityContext } from './delivery-availability.types';

export interface DeliveryAvailabilityContextInput {
  businessId: string;
  sellerCountry?: string | null;
  sellerState?: string | null;
  pickupLat?: number | string | null;
  pickupLon?: number | string | null;
  deliveryAddressId?: string | null;
  deliveryLat?: number | string | null;
  deliveryLon?: number | string | null;
  deliveryCountry?: string | null;
  deliveryState?: string | null;
  itemIds?: Array<string | null | undefined>;
  inventoryIds?: Array<string | null | undefined>;
  requiresFastDelivery?: boolean;
  verifiedAgentDelivery?: boolean;
  clientId?: string;
  evaluatedAt?: Date;
}

/** Shared by checkout preflight and order create so both gates see the same inputs. */
export function buildDeliveryAvailabilityContext(
  input: DeliveryAvailabilityContextInput
): DeliveryAvailabilityContext {
  return {
    businessId: input.businessId,
    sellerCountry: normalizedSellerCountry(input.sellerCountry),
    sellerState: (input.sellerState ?? '').trim(),
    pickupLat: finiteCoord(input.pickupLat),
    pickupLon: finiteCoord(input.pickupLon),
    deliveryAddressId: input.deliveryAddressId ?? undefined,
    deliveryLat: finiteCoord(input.deliveryLat),
    deliveryLon: finiteCoord(input.deliveryLon),
    deliveryCountry: input.deliveryCountry ?? undefined,
    deliveryState: input.deliveryState ?? undefined,
    itemIds: uniqueIds(input.itemIds),
    inventoryIds: uniqueIds(input.inventoryIds),
    requiresFastDelivery: input.requiresFastDelivery,
    verifiedAgentDelivery: input.verifiedAgentDelivery,
    clientId: input.clientId,
    evaluatedAt: input.evaluatedAt ?? new Date(),
  };
}

function normalizedSellerCountry(country?: string | null): string {
  const raw = (country ?? '').trim();
  if (!raw) return '';
  return normalizeDeliveryCountryCode(raw);
}

function finiteCoord(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueIds(values?: Array<string | null | undefined>): string[] {
  return [...new Set((values ?? []).filter((id): id is string => Boolean(id)))];
}
