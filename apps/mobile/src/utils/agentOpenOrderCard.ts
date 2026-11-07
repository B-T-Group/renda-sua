import type { Address, Order } from '../types/agent';
import { formatWindowChoiceLabel, formatTimeSlotValue } from './deliveryWindowUtils';
import { resolveOrderTimeWindow } from './businessOrderListDisplay';
import { orderModifiedAtMs } from './orderListSort';
import { haversineDistanceM } from './haversineDistanceM';
import { toFiniteNumber } from './formatKm';

export type AgentDropoffFact =
  | { kind: 'asap' }
  | { kind: 'scheduled'; when: string | null };

/**
 * Drop-off fact for an available-order card.
 * Null when the payload has no timing fields, so we do not call a scheduled order ASAP.
 */
export function agentDropoffFact(order: Order, locale: string): AgentDropoffFact | null {
  if (order.fulfillment_timing === 'asap') return { kind: 'asap' };
  const when = scheduledDropoffWhen(order, locale);
  if (order.fulfillment_timing === 'scheduled' || when) {
    return { kind: 'scheduled', when };
  }
  return null;
}

/** True when the list payload cannot show a drop-off time yet. */
export function openOrderNeedsDropoff(order: Order): boolean {
  const fact = agentDropoffFact(order, 'en');
  if (!fact) return true;
  return fact.kind === 'scheduled' && !fact.when;
}

/** Copy timing fields from an order-detail payload onto a list row. */
export function mergeOpenOrderDropoff(order: Order, detail: Partial<Order>): Order {
  const windows = detail.delivery_time_windows?.length
    ? detail.delivery_time_windows
    : order.delivery_time_windows;
  return {
    ...order,
    fulfillment_timing: detail.fulfillment_timing ?? order.fulfillment_timing,
    preferred_delivery_time: detail.preferred_delivery_time ?? order.preferred_delivery_time,
    estimated_delivery_time: detail.estimated_delivery_time ?? order.estimated_delivery_time,
    promised_fulfill_by: detail.promised_fulfill_by ?? order.promised_fulfill_by,
    delivery_time_window_id: detail.delivery_time_window_id ?? order.delivery_time_window_id,
    delivery_time_windows: windows,
  };
}

export interface CompactDropoff {
  day: 'today' | 'tomorrow' | 'date';
  dateLabel: string | null;
  slot: string | null;
  range: string | null;
}

/** One-line drop-off: Today · Evening · 4–8 PM. */
export function compactDropoff(order: Order, locale: string, now = new Date()): CompactDropoff | null {
  const window = resolveOrderTimeWindow(order);
  if (!window) return null;
  const slot = window.slot?.slot_name?.trim() || null;
  const range =
    window.time_slot_start && window.time_slot_end
      ? compactTimeRange(window.time_slot_start, window.time_slot_end, locale)
      : null;
  if (!window.preferred_date && !slot && !range) return null;
  return {
    day: window.preferred_date ? dayRelation(window.preferred_date, now) : 'date',
    dateLabel: window.preferred_date ? shortDateLabel(window.preferred_date, locale) : null,
    slot,
    range,
  };
}

function dayRelation(ymd: string, now: Date): 'today' | 'tomorrow' | 'date' {
  const target = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(target.getTime())) return 'date';
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((day.getTime() - start.getTime()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return 'date';
}

function shortDateLabel(ymd: string, locale: string): string {
  const date = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return ymd;
  return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

function clockParts(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function compactTimeRange(start: string, end: string, locale: string): string {
  const from = clockParts(start);
  const to = clockParts(end);
  if (!from || !to) {
    return `${formatTimeSlotValue(start, locale)}–${formatTimeSlotValue(end, locale)}`;
  }
  const french = locale.toLowerCase().startsWith('fr');
  const onTheHour = from.minute === 0 && to.minute === 0;
  const sameHalf = from.hour < 12 === to.hour < 12;
  if (!french && onTheHour && sameHalf) {
    const hour12 = (hour: number) => {
      const value = hour % 12;
      return value === 0 ? 12 : value;
    };
    return `${hour12(from.hour)}–${hour12(to.hour)} ${from.hour < 12 ? 'AM' : 'PM'}`;
  }
  return `${formatTimeSlotValue(start, locale)}–${formatTimeSlotValue(end, locale)}`;
}

function scheduledDropoffWhen(order: Order, locale: string): string | null {
  const window = resolveOrderTimeWindow(order);
  if (!window) return null;
  const slot = window.slot?.slot_name?.trim() || null;
  const range =
    window.time_slot_start && window.time_slot_end
      ? `${formatTimeSlotValue(window.time_slot_start, locale)} – ${formatTimeSlotValue(window.time_slot_end, locale)}`
      : null;
  if (window.preferred_date) {
    return formatWindowChoiceLabel(window.preferred_date, [slot, range], locale);
  }
  const loose = [slot, range].filter(Boolean).join(' · ');
  return loose || null;
}

/** Full drop-off line: street, line 2, city, state, postal, country. */
export function formatFullAddress(addr: Partial<Address> | null | undefined): string {
  if (!addr) return '';
  const street = [addr.address_line_1, addr.address_line_2]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  const locality = [addr.city, addr.state, addr.postal_code]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  const country = addr.country?.trim() || '';
  return [street, locality, country].filter(Boolean).join(', ');
}

function parseCoord(value: unknown): number | null {
  return toFiniteNumber(value);
}

/** Straight-line km from store to drop-off; null when either coordinate is missing. */
export function storeToDropoffKm(order: Order): number | null {
  const pickupLat = parseCoord(order.business_location?.address?.latitude);
  const pickupLng = parseCoord(order.business_location?.address?.longitude);
  const dropLat = parseCoord(order.delivery_address?.latitude);
  const dropLng = parseCoord(order.delivery_address?.longitude);
  if (pickupLat == null || pickupLng == null || dropLat == null || dropLng == null) {
    return null;
  }
  const meters = haversineDistanceM(pickupLat, pickupLng, dropLat, dropLng);
  return Math.round((meters / 1000) * 10) / 10;
}

function isDedicatedStore(order: Order, dedicatedIds?: ReadonlySet<string>): boolean {
  if (order.my_dedicated_store) return true;
  const id = order.business_location?.id;
  return id != null && dedicatedIds?.has(id) === true;
}

/** Dedicated stores first, then express, then most recently updated. */
export function compareOpenOrdersForAgent(
  a: Order,
  b: Order,
  dedicatedIds?: ReadonlySet<string>
): number {
  const dedicated =
    Number(isDedicatedStore(b, dedicatedIds)) - Number(isDedicatedStore(a, dedicatedIds));
  if (dedicated !== 0) return dedicated;
  if (a.requires_fast_delivery && !b.requires_fast_delivery) return -1;
  if (!a.requires_fast_delivery && b.requires_fast_delivery) return 1;
  return orderModifiedAtMs(b) - orderModifiedAtMs(a);
}
