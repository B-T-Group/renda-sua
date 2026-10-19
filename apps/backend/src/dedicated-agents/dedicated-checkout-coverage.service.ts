import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { DeliverySlotsService } from '../delivery/delivery-slots.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { resolveTimeZone } from '../restock-alerts/restock-time.util';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import type { DedicatedSlotKey } from './dedicated-agents.constants';
import { DEDICATED_LOCATION_PICKUP_SLOTS_QUERY } from './dedicated-assignments.queries';
import { DedicatedCoverageService } from './dedicated-coverage.service';
import type { DedicatedRail } from './dedicated-eligibility.util';
import { defaultPickupTime, localDateTimeAt, shortTime, slotKeyFromSlotName } from './dedicated-slot.util';

/** AC-C1b: how many local days (today included) checkout looks ahead for covered slots. */
export const DEDICATED_CHECKOUT_HORIZON_DAYS = 3;

/** One store-offered slot on one date that a dedicated agent can take for this cart. */
export interface DedicatedCoveredSlot {
  /** Local date (YYYY-MM-DD) in the seller's country timezone. */
  date: string;
  /** `delivery_time_slots.id`, the value the client sends as `delivery_window.slot_id`. */
  slot_id: string;
  slot_key: DedicatedSlotKey;
  /** Local `HH:MM`. */
  start: string;
  end: string;
  /** Business pickup time for that slot (AC-B2), local `HH:MM`. */
  pickup_time: string;
}

export interface DedicatedCoveredSlotsParams {
  locationId: string;
  country: string;
  state: string;
  rail: DedicatedRail;
  /** Seller-group cart subtotal: the hold base for independents. */
  subtotal: number;
  currency: string;
  verifiedAgentDelivery: boolean;
  now?: Date;
}

/**
 * #594 PR 4 (AC-C1b): the scheduled slots checkout can still offer for one
 * seller group when no agent is near the store right now. A slot is listed
 * only if the client could book it today (the same `DeliverySlotsService`
 * list: active, inside business hours, enabled by the business, capacity
 * left, at least 2 hours ahead) and a dedicated agent passes AC-E2 for this
 * cart on that date. Flag off -> null, so callers leave the response as it was.
 */
@Injectable()
export class DedicatedCheckoutCoverageService {
  private readonly logger = new Logger(DedicatedCheckoutCoverageService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly configService: DedicatedAgentsConfigService,
    private readonly deliveryConfigService: DeliveryConfigService,
    private readonly deliverySlotsService: DeliverySlotsService,
    private readonly coverage: DedicatedCoverageService
  ) {}

  /** Whether checkout should show the dedicated fields for this seller country. */
  async isEnabled(country: string | null | undefined): Promise<boolean> {
    const code = (country ?? '').trim().toUpperCase();
    if (!code) return false;
    return this.configService.isEnabled(code);
  }

  async coveredSlots(params: DedicatedCoveredSlotsParams): Promise<DedicatedCoveredSlot[]> {
    const country = params.country.trim().toUpperCase();
    if (!params.locationId || !(await this.isEnabled(country))) return [];
    const now = params.now ?? new Date();
    try {
      const configured = await this.deliveryConfigService.getTimezone(country).catch(() => null);
      const timeZone = resolveTimeZone(configured, country);
      const today = localDateTimeAt(now, timeZone).date;
      const dates = this.horizonDates(today);
      const perDate = await Promise.all(
        dates.map((date) =>
          this.deliverySlotsService.getAvailableSlots(
            country,
            params.state,
            date,
            false,
            timeZone,
            params.locationId
          )
        )
      );

      const eligibility = new Map<string, Promise<boolean>>();
      const isCovered = (slotKey: DedicatedSlotKey, date: string): Promise<boolean> => {
        // Off today only matters for today's slots; every later date shares one answer.
        const memo = `${slotKey}|${date === today ? date : 'later'}`;
        let pending = eligibility.get(memo);
        if (!pending) {
          pending = this.coverage
            .eligibleAgents({
              locationId: params.locationId,
              slotKey,
              fulfillmentTiming: 'scheduled',
              hasDeliveryWindow: true,
              rail: params.rail,
              subtotal: params.subtotal,
              currency: params.currency,
              verifiedAgentDelivery: params.verifiedAgentDelivery,
              slotDate: date,
              now,
            })
            .then((agents) => agents.length > 0);
          eligibility.set(memo, pending);
        }
        return pending;
      };

      const candidates = dates.flatMap((date, i) =>
        (perDate[i] ?? [])
          .filter((slot) => slot.is_available && slot.slot_type === 'standard')
          .map((slot) => ({ date, slot, slotKey: slotKeyFromSlotName(slot.slot_name) }))
          .filter((c): c is typeof c & { slotKey: DedicatedSlotKey } => c.slotKey != null)
      );
      if (candidates.length === 0) return [];

      const [covered, pickupTimes] = await Promise.all([
        Promise.all(candidates.map((c) => isCovered(c.slotKey, c.date))),
        this.pickupTimes(params.locationId),
      ]);
      return candidates
        .filter((_, i) => covered[i])
        .map(({ date, slot, slotKey }) => {
          const custom = pickupTimes.get(slotKey);
          return {
            date,
            slot_id: slot.id,
            slot_key: slotKey,
            start: shortTime(slot.start_time),
            end: shortTime(slot.end_time),
            pickup_time: custom
              ? shortTime(custom)
              : defaultPickupTime({ startTime: slot.start_time, endTime: slot.end_time }),
          };
        });
    } catch (error) {
      // Fail closed: no covered slots, checkout behaves as it does today.
      this.logger.warn(
        `Dedicated covered slots failed for location ${params.locationId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  private horizonDates(today: string): string[] {
    const start = DateTime.fromISO(today, { zone: 'utc' });
    return Array.from({ length: DEDICATED_CHECKOUT_HORIZON_DAYS }, (_, i) =>
      start.plus({ days: i }).toFormat('yyyy-MM-dd')
    );
  }

  private async pickupTimes(locationId: string): Promise<Map<string, string>> {
    const res = await this.hasuraSystemService.executeQuery<{
      business_location_pickup_slots: Array<{ slot_key: string; pickup_time: string | null }>;
    }>(DEDICATED_LOCATION_PICKUP_SLOTS_QUERY, { locationId });
    const out = new Map<string, string>();
    for (const row of res?.business_location_pickup_slots ?? []) {
      if (row.pickup_time) out.set(row.slot_key, row.pickup_time);
    }
    return out;
  }
}
