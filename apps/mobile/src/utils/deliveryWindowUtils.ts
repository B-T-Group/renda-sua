import type { DeliveryTimeSlot } from '../types/deliveryWindow';

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function buildDayOptionYmDs(extraYmd: string | null, horizonDays: number): string[] {
  const set = new Set<string>();
  const today = new Date();
  for (let i = 0; i < horizonDays; i += 1) {
    set.add(toYmd(addDays(today, i)));
  }
  if (extraYmd) set.add(extraYmd);
  return Array.from(set).sort();
}

export function isSlotBookable(s: DeliveryTimeSlot): boolean {
  return Boolean(s.is_available && s.available_capacity > 0);
}

/** Keep only calendar days that still have at least one bookable slot. */
export function ymDsWithBookableSlots(
  byDate: Array<{ date: string; slots: DeliveryTimeSlot[] }>
): string[] {
  return byDate
    .filter((day) => day.slots.some(isSlotBookable))
    .map((day) => day.date)
    .sort();
}

export function pickPreferredSlot(slots: DeliveryTimeSlot[]): DeliveryTimeSlot | null {
  const ok = (s: DeliveryTimeSlot) => isSlotBookable(s);
  const morning = slots.find((s) => ok(s) && s.slot_name.toLowerCase().includes('morning'));
  const afternoon = slots.find((s) => ok(s) && s.slot_name.toLowerCase().includes('afternoon'));
  const evening = slots.find((s) => ok(s) && s.slot_name.toLowerCase().includes('evening'));
  return morning ?? afternoon ?? evening ?? slots.find(ok) ?? null;
}

export function formatSlotTimeRange(slot: DeliveryTimeSlot): string {
  const start = (slot.start_time || '').slice(0, 5);
  const end = (slot.end_time || '').slice(0, 5);
  return start && end ? `${start} – ${end}` : '';
}

export function formatPreferredDate(ymd: string, locale: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCheckoutClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Fri 10:07 AM–Fri 10:37 AM", or a single clock when only one bound exists. */
export function formatCheckoutEtaRange(
  readyAt?: string | null,
  fulfillBy?: string | null
): string | null {
  if (!readyAt && !fulfillBy) return null;
  const ready = readyAt ? formatCheckoutClock(readyAt) : '';
  const fulfill = fulfillBy ? formatCheckoutClock(fulfillBy) : '';
  if (ready && fulfill && ready !== fulfill) return `${ready}–${fulfill}`;
  return ready || fulfill || null;
}

/** "Sat, Nov 7 · Morning · 10:00 – 12:00" */
export function formatWindowChoiceLabel(
  preferredDate: string,
  extras: Array<string | null | undefined>,
  locale: string
): string {
  const date = new Date(`${preferredDate}T12:00:00`);
  const dateLabel = Number.isNaN(date.getTime())
    ? preferredDate
    : date.toLocaleDateString(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
  const parts = extras.filter((part): part is string => Boolean(part?.trim()));
  return [dateLabel, ...parts].join(' · ');
}

export function formatTimeSlotValue(time: string | undefined, locale: string): string {
  if (!time?.trim()) return '';
  const normalized = time.length <= 5 ? `${time}:00` : time;
  try {
    return new Date(`2000-01-01T${normalized}`).toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return time;
  }
}
