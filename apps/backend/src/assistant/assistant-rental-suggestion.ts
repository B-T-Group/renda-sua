import { DateTime } from 'luxon';
import { latestExclusiveEndDate, type CardWindowOffer } from '../rentals/rental-card-window';
import { parseSearchDateRange } from '../rentals/rental-search.dates';

const LEAD_MS = 2 * 60 * 60 * 1000;

/** Display and suggestion cap use the cutoff rounded down to the hour. */
export function floorCardInstant(iso: string, zone: string): string {
  const floored = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone).startOf('hour');
  return floored.toUTC().toISO() ?? iso;
}

export function cutoffPlace(zone: string): string {
  const city = zone.split('/').pop() || zone;
  return city.replace(/_/g, ' ');
}

/** The day is already over, or fewer than 2 hours of it remain. */
export function startTooSoon(startDate: string, now: Date, zone: string): boolean {
  const earliest = DateTime.fromJSDate(now, { zone }).plus({ milliseconds: LEAD_MS });
  const dayEnd = DateTime.fromISO(startDate, { zone }).startOf('day').plus({ days: 1 });
  return dayEnd.toMillis() <= earliest.toMillis();
}

export function suggestionCap(latestIso: string, zone: string): string {
  return latestExclusiveEndDate(floorCardInstant(latestIso, zone), zone);
}

export function stayThroughCap(startDate: string, capEnd: string): CardWindowOffer | null {
  try {
    const range = parseSearchDateRange(startDate, capEnd);
    if (!range) return null;
    return { startDate: range.startDate, endDate: range.endDate, dayCount: range.dayCount };
  } catch {
    return null;
  }
}

export function earlierStart(startDate: string): string {
  return DateTime.fromISO(startDate, { zone: 'utc' }).minus({ days: 1 }).toFormat('yyyy-MM-dd');
}
