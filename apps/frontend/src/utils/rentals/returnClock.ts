import { listingNowMs } from '../rentalDayHoursPicker';

/**
 * The business return time is typed on the listing clock. start_at / end_at are that
 * clock written as UTC components (Toronto 18:00 is `T18:00:00Z`); actualEndAt sent to
 * the server is a real instant. These helpers move between the two so a phone or
 * browser in another zone does not shift the return (and the overtime) by hours.
 */

const DAY_MS = 86_400_000;

export interface ClockInput {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (24 h) */
  time: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function wallInput(wallMs: number): ClockInput {
  const d = new Date(wallMs);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/** What the listing clock shows at a real instant (e.g. now), as date + time fields. */
export function listingClockInput(instantMs: number, timeZone?: string | null): ClockInput {
  return wallInput(listingNowMs(instantMs, timeZone));
}

/** A stored wall-clock ISO (end_at) as date + time fields, with no zone shift. */
export function wallIsoInput(wallIso: string | null | undefined): ClockInput | null {
  const ms = Date.parse(String(wallIso ?? ''));
  return Number.isFinite(ms) ? wallInput(ms) : null;
}

/** Typed YYYY-MM-DD + HH:mm as listing wall-clock ms (UTC components); null when invalid. */
export function parseClockInput(date: string, time: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [y, mo, day, h, mi] = [Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])];
  if (h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo, day, h, mi);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo || back.getUTCDate() !== day) return null;
  return ms;
}

/**
 * The real instant when the listing clock shows `wallMs`. Same rule as the server
 * (wallClockToInstantMs): a repeated autumn time resolves to standard time and a
 * time skipped by spring-forward uses the offset in force before the jump.
 */
export function listingWallToInstantMs(wallMs: number, timeZone?: string | null): number {
  if (!Number.isFinite(wallMs)) return Number.NaN;
  const offsetAt = (instant: number) => listingNowMs(instant, timeZone) - instant;
  const before = wallMs - offsetAt(wallMs - DAY_MS);
  const after = wallMs - offsetAt(wallMs + DAY_MS);
  const hits = [before, after].filter((instant) => listingNowMs(instant, timeZone) === wallMs);
  return hits.length ? Math.max(...hits) : before;
}

/** Typed listing-clock date + time as the real-instant ISO to send as actualEndAt. */
export function clockInputToInstantIso(date: string, time: string, timeZone?: string | null): string | null {
  const wall = parseClockInput(date, time);
  if (wall == null) return null;
  const ms = listingWallToInstantMs(wall, timeZone);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** True when a typed listing-clock date + time is after a stored wall-clock end. */
export function clockInputAfterWall(date: string, time: string, wallIso: string | null | undefined): boolean {
  const typed = parseClockInput(date, time);
  const end = Date.parse(String(wallIso ?? ''));
  return typed != null && Number.isFinite(end) && typed > end;
}

/** `datetime-local` value (YYYY-MM-DDTHH:mm) of the listing clock at a real instant. */
export function listingDateTimeLocal(instantMs: number, timeZone?: string | null): string {
  const { date, time } = listingClockInput(instantMs, timeZone);
  return `${date}T${time}`;
}

/** A `datetime-local` value typed on the listing clock, as a real-instant ISO. */
export function dateTimeLocalToInstantIso(value: string, timeZone?: string | null): string | null {
  const [date, time] = String(value ?? '').split('T');
  if (!date || !time) return null;
  return clockInputToInstantIso(date, time.slice(0, 5), timeZone);
}
