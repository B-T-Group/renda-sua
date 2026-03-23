import type { RentalTakenWindow } from '../../hooks/useRentalApi';

export type WeeklyRow = {
  weekday: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
};

export type SelectionRange = { id: string; startMs: number; endMs: number };

const ONE_HOUR_MS = 60 * 60 * 1000;

export function rentalBillableHours(startMs: number, endMs: number): number {
  const ms = endMs - startMs;
  return Math.max(1, Math.ceil(ms / ONE_HOUR_MS));
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseClockToMs(hms: string): { h: number; m: number } {
  const p = hms.split(':').map(Number);
  return { h: p[0] ?? 0, m: p[1] ?? 0 };
}

/** Listing open/close instants for this calendar day in local TZ, or null if closed. */
export function listingDayBoundsLocal(day: Date, weekly: WeeklyRow[]): { open: Date; close: Date } | null {
  const wd = day.getDay();
  const row = weekly.find((w) => w.weekday === wd);
  if (!row?.is_available || !row.start_time || !row.end_time) return null;
  const sh = parseClockToMs(row.start_time);
  const eh = parseClockToMs(row.end_time);
  const open = new Date(day);
  open.setHours(sh.h, sh.m, 0, 0);
  const close = new Date(day);
  close.setHours(eh.h, eh.m, 0, 0);
  if (!(close > open)) return null;
  return { open, close };
}

export function rangesOverlapMs(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && a1 > b0;
}

/** Booked intervals that overlap [dayStart, dayEnd) in local time. */
export function bookedSegmentsForLocalDay(
  dayStart: Date,
  dayEnd: Date,
  booked: RentalTakenWindow[]
): Array<{ s: number; e: number }> {
  const d0 = dayStart.getTime();
  const d1 = dayEnd.getTime();
  const out: Array<{ s: number; e: number }> = [];
  for (const w of booked) {
    const s = new Date(w.startAt).getTime();
    const e = new Date(w.endAt).getTime();
    if (rangesOverlapMs(d0, d1, s, e)) {
      out.push({ s: Math.max(d0, s), e: Math.min(d1, e) });
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

/** True when no booking overlaps the listing's open–close window for that calendar day. */
export function dayHasNoBookedOverlap(open: Date, close: Date, booked: RentalTakenWindow[]): boolean {
  const s0 = open.getTime();
  const s1 = close.getTime();
  for (const w of booked) {
    const b0 = new Date(w.startAt).getTime();
    const b1 = new Date(w.endAt).getTime();
    if (rangesOverlapMs(s0, s1, b0, b1)) return false;
  }
  return true;
}

/** Full-hour slot start times between open and close (each slot is one hour; last start + 1h <= close). */
export function freeSlotStartsLocal(
  open: Date,
  close: Date,
  bookedSegs: Array<{ s: number; e: number }>,
  nowMs: number
): Date[] {
  const out: Date[] = [];
  let t = open.getTime();
  const endMs = close.getTime();
  while (t + ONE_HOUR_MS <= endMs) {
    const slotEnd = t + ONE_HOUR_MS;
    let blocked = false;
    for (const seg of bookedSegs) {
      if (rangesOverlapMs(t, slotEnd, seg.s, seg.e)) {
        blocked = true;
        break;
      }
    }
    if (!blocked && t >= nowMs) {
      out.push(new Date(t));
    }
    t += ONE_HOUR_MS;
  }
  return out;
}

export function freeSlotEndsLocal(
  startMs: number,
  close: Date,
  bookedSegs: Array<{ s: number; e: number }>
): Date[] {
  const out: Date[] = [];
  let t = startMs + ONE_HOUR_MS;
  const endMs = close.getTime();
  while (t <= endMs) {
    let blocked = false;
    for (const seg of bookedSegs) {
      if (rangesOverlapMs(startMs, t, seg.s, seg.e)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) out.push(new Date(t));
    t += ONE_HOUR_MS;
  }
  return out;
}

/** Contiguous bookable ranges from free hour starts (each range is [firstStart, lastStart+1h)). */
function groupContiguousFreeSlotStarts(starts: Date[]): Array<{ startMs: number; endMs: number }> {
  if (starts.length === 0) return [];
  const ranges: Array<{ startMs: number; endMs: number }> = [];
  let blockStart = starts[0].getTime();
  let prevStart = blockStart;
  for (let i = 1; i < starts.length; i++) {
    const t = starts[i].getTime();
    if (t === prevStart + ONE_HOUR_MS) {
      prevStart = t;
      continue;
    }
    ranges.push({ startMs: blockStart, endMs: prevStart + ONE_HOUR_MS });
    blockStart = t;
    prevStart = t;
  }
  ranges.push({ startMs: blockStart, endMs: prevStart + ONE_HOUR_MS });
  return ranges;
}

/** Maximal contiguous free hour ranges for the listing day (respects bookings and nowMs). */
export function maximalFreeHourRangesLocal(
  open: Date,
  close: Date,
  bookedSegs: Array<{ s: number; e: number }>,
  nowMs: number
): Array<{ startMs: number; endMs: number }> {
  const starts = freeSlotStartsLocal(open, close, bookedSegs, nowMs);
  return groupContiguousFreeSlotStarts(starts);
}

export function mergeRangeIntoSelections(
  prev: SelectionRange[],
  startMs: number,
  endMs: number
): SelectionRange[] {
  const key = localDateKey(new Date(startMs));
  const others = prev.filter((r) => localDateKey(new Date(r.startMs)) !== key);
  const sameDay = prev.filter((r) => localDateKey(new Date(r.startMs)) === key);
  const merged = mergeTouchingRanges([...sameDay.map((r) => ({ s: r.startMs, e: r.endMs })), { s: startMs, e: endMs }]);
  const next: SelectionRange[] = merged.map((m, i) => ({
    id: `${key}-${m.s}-${m.e}-${i}`,
    startMs: m.s,
    endMs: m.e,
  }));
  return [...others, ...next].sort((a, b) => a.startMs - b.startMs);
}

function mergeTouchingRanges(ranges: Array<{ s: number; e: number }>): Array<{ s: number; e: number }> {
  const sorted = [...ranges].sort((a, b) => a.s - b.s);
  const out: Array<{ s: number; e: number }> = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (!last || r.s > last.e) {
      out.push({ s: r.s, e: r.e });
    } else {
      last.e = Math.max(last.e, r.e);
    }
  }
  return out;
}

export function totalBillableHours(selections: SelectionRange[]): number {
  let h = 0;
  for (const r of selections) {
    h += rentalBillableHours(r.startMs, r.endMs);
  }
  return h;
}

export function formatSelectionLabel(startMs: number, endMs: number, locale?: string): string {
  const s = new Date(startMs);
  const e = new Date(endMs);
  try {
    const dayPart = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(s);
    const t0 = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(s);
    const t1 = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(e);
    return `${dayPart} · ${t0} – ${t1}`;
  } catch {
    return `${s.toLocaleString()} – ${e.toLocaleString()}`;
  }
}
