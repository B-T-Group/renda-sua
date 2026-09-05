import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import {
  minutesUntilClose,
  nextOpenAt,
} from '../common/operating-hours.util';
import type { Configuration, OrderConfig } from '../config/configuration';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { parseCalendarDatePartsFromPreferredDate } from '../users/user-timezone.util';
import { parseSlotTime } from './order-cleanup-window.util';
import type {
  AsapAvailability,
  AsapDisabledReason,
  FulfillmentPromise,
  FulfillmentTiming,
  PromiseOrderSnapshot,
} from './fulfillment-promise.types';

const CLOSED_MESSAGE =
  'This store is closed. Select a future delivery or pickup date below.';
const CLOSING_SOON_MESSAGE =
  'This store is closed or closing too soon to fulfill now. Select a future delivery or pickup date below.';

@Injectable()
export class FulfillmentPromiseService {
  private readonly logger = new Logger(FulfillmentPromiseService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly configService: ConfigService<Configuration>,
    private readonly deliveryConfigService: DeliveryConfigService
  ) {}

  closedStoreMessage(reason?: AsapDisabledReason): string {
    return reason === 'too_close_to_close'
      ? CLOSING_SOON_MESSAGE
      : CLOSED_MESSAGE;
  }

  inferTiming(
    hasWindow: boolean,
    method?: string | null
  ): FulfillmentTiming | null {
    if (method === 'shipping') return null;
    return hasWindow ? 'scheduled' : 'asap';
  }

  evaluateAsap(params: {
    operatingHours: unknown;
    prepMinutes: number;
    fulfillmentMethod: 'delivery' | 'pickup' | 'shipping';
    timezone: string;
    isFastDelivery?: boolean;
    now?: Date;
  }): AsapAvailability {
    if (params.fulfillmentMethod === 'shipping') {
      return {
        available: false,
        estimatedPrepMinutes: params.prepMinutes,
        scheduleRequired: false,
      };
    }
    const now = params.now ?? new Date();
    const remaining = minutesUntilClose(
      params.operatingHours,
      now,
      params.timezone
    );
    const needed = this.minutesNeededBeforeClose(
      params.prepMinutes,
      params.fulfillmentMethod,
      params.isFastDelivery === true
    );
    if (remaining === 0) {
      return this.unavailable(
        'merchant_closed',
        params.prepMinutes,
        params.operatingHours,
        now,
        params.timezone
      );
    }
    if (remaining != null && remaining < needed) {
      return this.unavailable(
        'too_close_to_close',
        params.prepMinutes,
        params.operatingHours,
        now,
        params.timezone
      );
    }
    const promise = this.computeAsapPromise(
      params.fulfillmentMethod,
      params.prepMinutes,
      params.isFastDelivery === true,
      now
    );
    return {
      available: true,
      estimatedPrepMinutes: params.prepMinutes,
      estimatedReadyAt: promise.promisedReadyAt.toISOString(),
      estimatedFulfillBy: promise.promisedFulfillBy.toISOString(),
      scheduleRequired: false,
    };
  }

  computeAsapPromise(
    method: 'delivery' | 'pickup',
    prepMinutes: number,
    isFastDelivery: boolean,
    now = new Date()
  ): FulfillmentPromise {
    const cfg = this.orderConfig();
    const ready = new Date(now.getTime() + prepMinutes * 60 * 1000);
    const extra =
      method === 'pickup'
        ? cfg.asapPickupGraceMinutes
        : isFastDelivery
          ? cfg.asapFastTravelBufferMinutes
          : cfg.asapTravelBufferMinutes;
    return {
      fulfillmentTiming: 'asap',
      promisedReadyAt: ready,
      promisedFulfillBy: new Date(ready.getTime() + extra * 60 * 1000),
    };
  }

  computeScheduledPromise(
    preferredDate: string,
    slotStart: string,
    slotEnd: string,
    timezone: string
  ): FulfillmentPromise | null {
    const start = this.slotInstant(preferredDate, slotStart, timezone);
    const end = this.slotInstant(preferredDate, slotEnd, timezone);
    if (!start || !end) return null;
    return {
      fulfillmentTiming: 'scheduled',
      promisedReadyAt: start,
      promisedFulfillBy: end,
    };
  }

  /**
   * Restart the ASAP clock at ready time (prep already done). Store-pickup
   * never writes pickup_by, so cleanup must not keep the placement-time
   * promised_fulfill_by or a late prep can expire the grace window.
   */
  async reanchorAsapAtReady(orderId: string, now = new Date()): Promise<void> {
    try {
      await this.writeAsapReadyPromise(orderId, now);
    } catch (error: any) {
      this.logger.warn(
        `Failed to reanchor ASAP promise for ${orderId}: ${error?.message}`
      );
    }
  }

  private async writeAsapReadyPromise(orderId: string, now: Date): Promise<void> {
    const order = await this.fetchOrder(orderId);
    if (!this.shouldReanchorAsap(order) || !order) return;
    const method = order.fulfillmentMethod === 'pickup' ? 'pickup' : 'delivery';
    await this.writePromise(
      orderId,
      'asap',
      this.computeAsapPromise(method, 0, order.requiresFastDelivery === true, now)
    );
  }

  async persistForOrder(
    orderId: string,
    options?: { extendPrepMinutes?: number }
  ): Promise<void> {
    const order = await this.fetchOrder(orderId);
    if (!order || order.fulfillmentMethod === 'shipping') return;
    const timezone = await this.timezoneFor(order);
    const prep = await this.prepMinutes(order);
    const window = order.deliveryTimeWindows?.[0];
    const hasWindow = Boolean(window?.preferredDate && window.slotStart);
    const timing = this.inferTiming(hasWindow, order.fulfillmentMethod);
    if (!timing) return;
    if (!hasWindow && order.fulfillmentTiming === 'scheduled') {
      return;
    }
    const promise = hasWindow
      ? this.computeScheduledPromise(
          window!.preferredDate as string,
          window!.slotStart as string,
          (window!.slotEnd || window!.slotStart) as string,
          timezone
        )
      : this.resolveAsapPromise(order, prep, options?.extendPrepMinutes);
    if (!promise) return;
    await this.writePromise(orderId, timing, promise);
  }

  private shouldReanchorAsap(order: PromiseOrderSnapshot | null): boolean {
    if (!order || order.fulfillmentMethod === 'shipping') return false;
    if (order.fulfillmentTiming === 'scheduled') return false;
    return (
      order.fulfillmentTiming === 'asap' ||
      !order.deliveryTimeWindows?.[0]?.preferredDate
    );
  }

  private resolveAsapPromise(
    order: PromiseOrderSnapshot,
    prep: number,
    extendPrepMinutes?: number
  ): FulfillmentPromise {
    const existing = this.existingAsapPromise(order);
    if (existing) {
      const extra = Math.max(0, extendPrepMinutes ?? 0);
      if (!extra) return existing;
      const ms = extra * 60 * 1000;
      return {
        fulfillmentTiming: 'asap',
        promisedReadyAt: new Date(existing.promisedReadyAt.getTime() + ms),
        promisedFulfillBy: new Date(existing.promisedFulfillBy.getTime() + ms),
      };
    }
    return this.computeAsapPromise(
      order.fulfillmentMethod === 'pickup' ? 'pickup' : 'delivery',
      prep,
      order.requiresFastDelivery === true
    );
  }

  private existingAsapPromise(
    order: PromiseOrderSnapshot
  ): FulfillmentPromise | null {
    if (!order.promisedReadyAt || !order.promisedFulfillBy) return null;
    const ready = new Date(order.promisedReadyAt);
    const fulfillBy = new Date(order.promisedFulfillBy);
    if (Number.isNaN(ready.getTime()) || Number.isNaN(fulfillBy.getTime())) {
      return null;
    }
    return {
      fulfillmentTiming: 'asap',
      promisedReadyAt: ready,
      promisedFulfillBy: fulfillBy,
    };
  }

  async timezoneForCountry(country?: string | null): Promise<string> {
    return this.deliveryConfigService.getTimezone(country || 'GA');
  }

  private unavailable(
    reason: AsapDisabledReason,
    prepMinutes: number,
    operatingHours: unknown,
    now: Date,
    timezone: string
  ): AsapAvailability {
    const opens = nextOpenAt(operatingHours, now, timezone);
    return {
      available: false,
      reason,
      opensAt: opens?.toISOString() ?? null,
      estimatedPrepMinutes: prepMinutes,
      scheduleRequired: true,
    };
  }

  private minutesNeededBeforeClose(
    prepMinutes: number,
    method: 'delivery' | 'pickup',
    isFastDelivery: boolean
  ): number {
    const cfg = this.orderConfig();
    const extra =
      method === 'pickup'
        ? cfg.asapPickupGraceMinutes
        : isFastDelivery
          ? cfg.asapFastTravelBufferMinutes
          : cfg.asapTravelBufferMinutes;
    return prepMinutes + extra + cfg.asapCloseBufferMinutes;
  }

  private slotInstant(
    preferredDate: string,
    time: string,
    timezone: string
  ): Date | null {
    const parsed = parseSlotTime(time);
    if (!parsed) return null;
    const { year, month, day } =
      parseCalendarDatePartsFromPreferredDate(preferredDate);
    const dt = DateTime.fromObject(
      {
        year,
        month,
        day,
        hour: parsed.hours,
        minute: parsed.minutes,
        second: 0,
      },
      { zone: timezone }
    );
    if (!dt.isValid) return null;
    return dt.toUTC().toJSDate();
  }

  private orderConfig(): OrderConfig {
    return this.configService.get('order') as OrderConfig;
  }

  private async prepMinutes(order: PromiseOrderSnapshot): Promise<number> {
    if (
      typeof order.estimatedPrepMinutes === 'number' &&
      order.estimatedPrepMinutes > 0
    ) {
      return order.estimatedPrepMinutes;
    }
    const cfg = this.orderConfig();
    const res = await this.hasura.executeQuery(
      `query PromisePrep($id: uuid!) {
        businesses_by_pk(id: $id) { default_estimated_prep_minutes }
      }`,
      { id: order.businessId }
    );
    const raw = res.businesses_by_pk?.default_estimated_prep_minutes;
    return typeof raw === 'number' && raw > 0
      ? raw
      : cfg.defaultEstimatedPrepMinutes;
  }

  private async timezoneFor(order: PromiseOrderSnapshot): Promise<string> {
    const country =
      order.businessLocation?.address?.country ||
      order.deliveryAddress?.country ||
      'GA';
    return this.timezoneForCountry(country);
  }

  private async fetchOrder(
    orderId: string
  ): Promise<PromiseOrderSnapshot | null> {
    const res = await this.hasura.executeQuery(
      `query PromiseOrder($id: uuid!) {
        orders_by_pk(id: $id) {
          id business_id fulfillment_method requires_fast_delivery
          estimated_prep_minutes fulfillment_timing
          promised_ready_at promised_fulfill_by current_status
          business_location { address { country } }
          delivery_address { country }
          delivery_time_windows(order_by: { created_at: desc }, limit: 1) {
            preferred_date time_slot_start time_slot_end
          }
        }
      }`,
      { id: orderId }
    );
    const row = res.orders_by_pk;
    if (!row) return null;
    return {
      id: row.id,
      businessId: row.business_id,
      fulfillmentMethod: row.fulfillment_method,
      requiresFastDelivery: row.requires_fast_delivery,
      estimatedPrepMinutes: row.estimated_prep_minutes,
      fulfillmentTiming: row.fulfillment_timing,
      promisedReadyAt: row.promised_ready_at,
      promisedFulfillBy: row.promised_fulfill_by,
      currentStatus: row.current_status,
      businessLocation: row.business_location,
      deliveryAddress: row.delivery_address,
      deliveryTimeWindows: (row.delivery_time_windows || []).map((w: any) => ({
        preferredDate: w.preferred_date,
        slotStart: w.time_slot_start,
        slotEnd: w.time_slot_end,
      })),
    };
  }

  private async writePromise(
    orderId: string,
    timing: FulfillmentTiming,
    promise: FulfillmentPromise
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation SetFulfillmentPromise(
        $id: uuid!, $timing: String!, $ready: timestamptz!, $by: timestamptz!,
        $eta: timestamptz!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            fulfillment_timing: $timing
            promised_ready_at: $ready
            promised_fulfill_by: $by
            estimated_delivery_time: $eta
          }
        ) { id }
      }`,
      {
        id: orderId,
        timing,
        ready: promise.promisedReadyAt.toISOString(),
        by: promise.promisedFulfillBy.toISOString(),
        eta: promise.promisedFulfillBy.toISOString(),
      }
    );
  }
}
