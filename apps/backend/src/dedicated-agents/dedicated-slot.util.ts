import { DateTime } from 'luxon';
import { DEDICATED_SLOT_KEYS, type DedicatedSlotKey } from './dedicated-agents.constants';

/** A store-offered standard delivery slot (from `delivery_time_slots`), keyed for #594. */
export interface DedicatedSlotBounds {
  slotKey: DedicatedSlotKey;
  slotId: string;
  /** Local wall-clock bounds, `HH:MM[:SS]`, as stored in `delivery_time_slots`. */
  startTime: string;
  endTime: string;
}

export interface DeliveryTimeSlotRow {
  id: string;
  slot_name: string;
  slot_type?: string | null;
  start_time: string;
  end_time: string;
  state?: string | null;
}

/**
 * `delivery_time_slots.slot_name` -> slot key. Only the standard Morning /
 * Afternoon / Evening rows map; "Morning Fast" etc. are same-day fast slots
 * and never carry dedicated coverage.
 */
export function slotKeyFromSlotName(name: string | null | undefined): DedicatedSlotKey | null {
  const key = (name ?? '').trim().toLowerCase();
  return (DEDICATED_SLOT_KEYS as readonly string[]).includes(key)
    ? (key as DedicatedSlotKey)
    : null;
}

/** `HH:MM` or `HH:MM:SS` -> minutes since local midnight; null when malformed. */
export function timeToMinutes(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((time ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** Standard slots with a known key and valid bounds, at most one per key (first wins). */
export function toDedicatedSlotBounds(rows: DeliveryTimeSlotRow[]): DedicatedSlotBounds[] {
  const out: DedicatedSlotBounds[] = [];
  for (const row of rows) {
    if (row.slot_type && row.slot_type !== 'standard') continue;
    const slotKey = slotKeyFromSlotName(row.slot_name);
    const start = timeToMinutes(row.start_time);
    const end = timeToMinutes(row.end_time);
    if (!slotKey || start == null || end == null || end <= start) continue;
    if (out.some((s) => s.slotKey === slotKey)) continue;
    out.push({ slotKey, slotId: row.id, startTime: row.start_time, endTime: row.end_time });
  }
  return out;
}

/**
 * The slot a local wall-clock time belongs to: start <= t < end. A time in the
 * D12 end grace (end <= t < end + grace) still belongs to that slot unless
 * another slot has already started (12:00 is Afternoon, not Morning-grace).
 */
export function resolveSlotForLocalTime(
  slots: DedicatedSlotBounds[],
  localTime: string,
  graceMinutes: number
): DedicatedSlotBounds | null {
  const t = timeToMinutes(localTime);
  if (t == null) return null;
  const within = slots.find((s) => {
    const start = timeToMinutes(s.startTime) as number;
    const end = timeToMinutes(s.endTime) as number;
    return t >= start && t < end;
  });
  if (within) return within;
  const grace = Math.max(0, graceMinutes);
  return (
    slots.find((s) => {
      const end = timeToMinutes(s.endTime) as number;
      return t >= end && t < end + grace;
    }) ?? null
  );
}

/** Local calendar date and wall-clock time of an instant in `timeZone` (D12: country timezone). */
export function localDateTimeAt(at: Date, timeZone: string): { date: string; time: string } {
  const local = DateTime.fromJSDate(at, { zone: 'utc' }).setZone(timeZone);
  const zoned = local.isValid ? local : DateTime.fromJSDate(at, { zone: 'utc' });
  return { date: zoned.toFormat('yyyy-MM-dd'), time: zoned.toFormat('HH:mm') };
}
