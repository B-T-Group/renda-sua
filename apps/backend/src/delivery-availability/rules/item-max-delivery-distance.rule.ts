import { Injectable, Logger } from '@nestjs/common';
import { haversineDistanceKm } from '../../common/agent-proximity.util';
import { GoogleDistanceService } from '../../google/google-distance.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import {
  DeliveryAvailabilityContext,
  DeliveryAvailabilityRule,
  DeliveryAvailabilityRuleOutcome,
  DeliveryUnavailableReason,
} from '../delivery-availability.types';

interface ItemDistanceRow {
  id: string;
  max_delivery_distance: number | string | null;
}

const ITEM_DISTANCES_QUERY = `
  query ItemMaxDeliveryDistances($itemIds: [uuid!]!) {
    items(where: { id: { _in: $itemIds } }) {
      id
      max_delivery_distance
    }
  }
`;

const ADDRESS_FOR_GEOCODE_QUERY = `
  query AddressForGeocode($addressId: uuid!) {
    addresses_by_pk(id: $addressId) {
      address_line_1
      city
      state
      postal_code
      country
      latitude
      longitude
    }
  }
`;

/**
 * Enforces the per-item `items.max_delivery_distance` (km) merchants already
 * edit in the UI: the store→client Haversine distance must not exceed the
 * strictest item limit in the order. When the selected address has no stored
 * coordinates, falls back to geocoding it. Skips only when the delivery
 * location is genuinely unknown (e.g. preflight before an address is chosen).
 */
@Injectable()
export class ItemMaxDeliveryDistanceRule implements DeliveryAvailabilityRule {
  readonly id = 'item-max-delivery-distance';
  readonly order = 60;
  private readonly logger = new Logger(ItemMaxDeliveryDistanceRule.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly googleDistanceService: GoogleDistanceService
  ) {}

  async evaluate(
    ctx: DeliveryAvailabilityContext
  ): Promise<DeliveryAvailabilityRuleOutcome> {
    if (
      ctx.pickupLat == null ||
      ctx.pickupLon == null ||
      !ctx.itemIds ||
      ctx.itemIds.length === 0
    ) {
      return { pass: true };
    }

    const limits = await this.fetchItemLimits(ctx.itemIds);
    if (limits.length === 0) return { pass: true };

    const delivery = await this.resolveDeliveryCoords(ctx);
    if (!delivery) return { pass: true };

    const strictestKm = Math.min(...limits.map((l) => l.maxKm));
    const distanceKm = haversineDistanceKm(
      ctx.pickupLat,
      ctx.pickupLon,
      delivery.lat,
      delivery.lon
    );

    if (distanceKm > strictestKm) {
      return {
        pass: false,
        reason: DeliveryUnavailableReason.DELIVERY_RADIUS_EXCEEDED,
        metadata: {
          maxDeliveryDistanceKm: strictestKm,
          clientDistanceKm: Math.round(distanceKm * 100) / 100,
          limitingItemId: limits.find((l) => l.maxKm === strictestKm)?.itemId,
        },
      };
    }

    return { pass: true };
  }

  /**
   * Context coordinates first; otherwise geocode the selected address. Null
   * means the delivery location is unknown (no address chosen yet, or the
   * address could not be geocoded) — the rule then passes rather than
   * blocking checkout on missing data.
   */
  private async resolveDeliveryCoords(
    ctx: DeliveryAvailabilityContext
  ): Promise<{ lat: number; lon: number } | null> {
    if (ctx.deliveryLat != null && ctx.deliveryLon != null) {
      return { lat: ctx.deliveryLat, lon: ctx.deliveryLon };
    }
    if (!ctx.deliveryAddressId) return null;

    try {
      return await this.geocodeAddress(ctx.deliveryAddressId);
    } catch (error: any) {
      this.logger.warn(
        `Could not resolve delivery coordinates for address ${ctx.deliveryAddressId}: ${error?.message}`
      );
      return null;
    }
  }

  private async geocodeAddress(
    addressId: string
  ): Promise<{ lat: number; lon: number } | null> {
    const result = await this.hasuraSystemService.executeQuery(
      ADDRESS_FOR_GEOCODE_QUERY,
      { addressId }
    );
    const addr = result?.addresses_by_pk;
    if (!addr) return null;
    if (addr.latitude != null && addr.longitude != null) {
      return { lat: Number(addr.latitude), lon: Number(addr.longitude) };
    }

    const formatted = [
      addr.address_line_1,
      addr.city,
      addr.state,
      addr.postal_code,
      addr.country,
    ]
      .filter((part) => part && String(part).trim() !== '')
      .join(', ');
    const geo = await this.googleDistanceService.geocode(formatted);
    return geo ? { lat: geo.latitude, lon: geo.longitude } : null;
  }

  /** Items without a positive max_delivery_distance impose no limit. */
  private async fetchItemLimits(
    itemIds: string[]
  ): Promise<Array<{ itemId: string; maxKm: number }>> {
    const result = await this.hasuraSystemService.executeQuery(
      ITEM_DISTANCES_QUERY,
      { itemIds }
    );
    const rows = (result?.items ?? []) as ItemDistanceRow[];
    return rows
      .map((r) => ({ itemId: r.id, maxKm: Number(r.max_delivery_distance) }))
      .filter((r) => Number.isFinite(r.maxKm) && r.maxKm > 0);
  }
}
