import type { BusinessRentalScheduleRow } from '../../types/rentals';

export type ScheduleSectionKey = 'today' | 'upcoming' | 'past';

export interface ScheduleSection {
  key: ScheduleSectionKey;
  data: BusinessRentalScheduleRow[];
}

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sectionKeyFor(row: BusinessRentalScheduleRow, nowMs: number): ScheduleSectionKey {
  const dayStart = startOfLocalDay(nowMs);
  const dayEnd = dayStart + DAY_MS;
  if (new Date(row.end_at).getTime() < dayStart) return 'past';
  if (new Date(row.start_at).getTime() < dayEnd) return 'today';
  return 'upcoming';
}

const SECTION_ORDER: ScheduleSectionKey[] = ['today', 'upcoming', 'past'];

/** Groups bookings into Today (overlapping today), Upcoming and Past (ended before today). */
export function groupScheduleRows(
  rows: BusinessRentalScheduleRow[],
  nowMs: number
): ScheduleSection[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
  return SECTION_ORDER.map((key) => ({
    key,
    data: sorted.filter((row) => sectionKeyFor(row, nowMs) === key),
  })).filter((section) => section.data.length > 0);
}

/** Merges per-item schedules, soonest start first, dropping duplicate booking ids. */
export function mergeScheduleRows(
  lists: BusinessRentalScheduleRow[][]
): BusinessRentalScheduleRow[] {
  const byId = new Map<string, BusinessRentalScheduleRow>();
  lists.flat().forEach((row) => byId.set(row.id, row));
  return [...byId.values()].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
}

export function scheduleDurationParts(startIso: string, endIso: string): DurationParts {
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMinutes = Number.isFinite(diff) && diff > 0 ? Math.round(diff / MINUTE_MS) : 0;
  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor((totalMinutes % (24 * 60)) / 60),
    minutes: totalMinutes % 60,
  };
}

export function scheduleClientName(row: BusinessRentalScheduleRow): string {
  const user = row.rental_request?.client?.user;
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ');
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function formatDay(date: Date, language: string): string {
  return date.toLocaleDateString(language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatClock(date: Date, language: string): string {
  return date.toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit' });
}

/** One line for the date: `Fri, Nov 27` or `Fri, Nov 27 → Sun, Nov 29` across days. */
export function formatScheduleDateLine(startIso: string, endIso: string, language: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return startIso;
  if (sameLocalDay(start, end)) return formatDay(start, language);
  return `${formatDay(start, language)} → ${formatDay(end, language)}`;
}

/** One line for the time window: `8:00 AM – 10:00 AM`. */
export function formatScheduleTimeLine(startIso: string, endIso: string, language: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return endIso;
  return `${formatClock(start, language)} – ${formatClock(end, language)}`;
}
