import { listingTimeZone, parseSlotKey, serverCaptureTimestamp, uploadPlatform } from './pickup-photo-rules';

export const INSPECTION_OPTIN_KEY = 'rentals_inspection_optin_enabled';
export const BASELINE_SLOTS = ['overview', 'other_side', 'accessories'] as const;
export const PICKUP_PHOTO_AFTER_START = 'PICKUP_PHOTO_AFTER_START';
export const INSPECTION_BASELINE_REQUIRED = 'INSPECTION_BASELINE_REQUIRED';
export const PICKUP_REUSE_BLOCKED_DAMAGE = 'PICKUP_REUSE_BLOCKED_DAMAGE';
export const PICKUP_REUSE_UNAVAILABLE = 'PICKUP_REUSE_UNAVAILABLE';

export type CaptureSource = 'camera' | 'gallery' | 'web';
export type CapturedAtSource = 'exif' | 'upload';
export type ReuseBlock = 'upheld' | 'reported';

export interface CaptureColumns {
  captured_at: string;
  slot_key: string | null;
  capture_source: CaptureSource | null;
  captured_at_source: CapturedAtSource | null;
  reused: boolean;
  exif_captured_at: string | null;
}

export interface UnitReturnFacts {
  slotIndex: number;
  resolution: string | null;
  claimed: number | null;
  upheld: boolean;
  reported: boolean;
  submittedAt: string | null;
}

/** A new booking is inspected only when the item opted in and the baseline is complete. */
export function itemOptInStamps(optedIn: boolean, baselineReady: boolean): boolean {
  return optedIn === true && baselineReady === true;
}

export function baselineReady(readySlots: string[]): boolean {
  const have = new Set(readySlots);
  return BASELINE_SLOTS.every((slot) => have.has(slot));
}

/** Turning opt-in off does not clear a policy already stamped on a booking. */
export function optOutKeepsStamp(existingPolicy: number | null): number | null {
  return existingPolicy;
}

export function isBeforeRentalStart(startAt: Date, now: Date): boolean {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(now.getTime())) return false;
  return now.getTime() < startAt.getTime();
}

export function reuseDamage(input: {
  claimed: number | null;
  upheld: boolean;
  reported: boolean;
}): ReuseBlock | null {
  if (input.upheld) return 'upheld';
  if (input.reported || (input.claimed != null && input.claimed > 0)) return 'reported';
  return null;
}

/** Latest return per unit. An older clean return is ignored once a newer one exists. */
export function latestReturnsBySlot<T extends { slotIndex: number; submittedAt: string | null }>(rows: T[]): T[] {
  const sorted = [...rows].sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const seen = new Set<number>();
  const latest: T[] = [];
  for (const row of sorted) {
    if (seen.has(row.slotIndex)) continue;
    seen.add(row.slotIndex);
    latest.push(row);
  }
  return latest;
}

export function returnIsClean(row: UnitReturnFacts): boolean {
  if (row.resolution !== 'accepted') return false;
  if (row.upheld || row.reported) return false;
  return !(row.claimed != null && row.claimed > 0);
}

export function reuseChoice(input: {
  returns: Array<{ clean: boolean }>;
  hasBaseline: boolean;
}): { ok: true; source: 'return' | 'baseline' } | { ok: false; code: string } {
  if (input.returns.some((row) => !row.clean)) return { ok: false, code: PICKUP_REUSE_BLOCKED_DAMAGE };
  if (input.returns.length > 0) return { ok: true, source: 'return' };
  if (input.hasBaseline) return { ok: true, source: 'baseline' };
  return { ok: false, code: PICKUP_REUSE_UNAVAILABLE };
}

export function rolesComplete(slots: string[]): boolean {
  const have = new Set(slots);
  return BASELINE_SLOTS.every((slot) => have.has(slot));
}

export function matchTargetUnit(
  source: { slotIndex: number; label: string | null },
  targets: Array<{ id: string; slotIndex: number; label: string | null }>,
  sourceCount: number
): string | null {
  const bySlot = targets.find((row) => row.slotIndex === source.slotIndex);
  if (bySlot) return bySlot.id;
  const byLabel = source.label
    ? targets.find((row) => row.label != null && row.label === source.label)
    : undefined;
  if (byLabel) return byLabel.id;
  if (sourceCount === 1 && targets.length === 1) return targets[0].id;
  return null;
}

export function optInCaptureColumns(input: {
  slotKey?: string | null;
  clock: Date;
  timeZone: string;
  exif?: string | null;
  source?: string | null;
  platform?: string | string[];
}): CaptureColumns {
  const exifAt = clampExif(input.exif, input.timeZone, input.clock);
  return {
    captured_at: input.clock.toISOString(),
    slot_key: parseSlotKey(input.slotKey),
    capture_source: normalizeSource(input.source, input.platform),
    captured_at_source: 'upload',
    reused: false,
    exif_captured_at: exifAt ? exifAt.toISOString() : null,
  };
}

const EXIF_SKEW_MS = 2 * 60 * 1000;
const EXIF_FLOOR_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** EXIF is extra info. It never becomes the date the renter is shown. */
export function clampExif(raw: string | null | undefined, timeZone: string, now: Date): Date | null {
  const parsed = parseExifCapture(raw, timeZone);
  if (!parsed || Number.isNaN(now.getTime())) return null;
  if (parsed.getTime() > now.getTime() + EXIF_SKEW_MS) return null;
  if (parsed.getTime() < now.getTime() - EXIF_FLOOR_MS) return null;
  return parsed;
}

export function reusedColumns(input: {
  slotKey: string;
  capturedAt: string;
  source: string | null;
  atSource: string | null;
}): CaptureColumns {
  return {
    captured_at: input.capturedAt,
    slot_key: parseSlotKey(input.slotKey),
    capture_source: knownSource(input.source),
    captured_at_source: knownAtSource(input.atSource) ?? 'upload',
    reused: true,
    exif_captured_at: null,
  };
}

export function zoneForCountry(country: string | null | undefined): string {
  return listingTimeZone(country);
}

function normalizeSource(source: string | null | undefined, platform?: string | string[]): CaptureSource | null {
  const known = knownSource(source);
  if (known) return known;
  return uploadPlatform(platform) === 'web' ? 'web' : null;
}

function knownSource(source: string | null | undefined): CaptureSource | null {
  if (source === 'camera' || source === 'gallery' || source === 'web') return source;
  return null;
}

function knownAtSource(source: string | null | undefined): CapturedAtSource | null {
  if (source === 'exif' || source === 'upload') return source;
  return null;
}

export function parseExifCapture(raw: string | null | undefined, timeZone: string): Date | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (hasZoneOffset(value)) return offsetInstant(value);
  return wallInstant(value, timeZone);
}

function hasZoneOffset(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function offsetInstant(value: string): Date | null {
  const iso = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function wallInstant(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})[:/-](\d{2})[:/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return utcFromWall(match.slice(1).map((part) => Number(part)), timeZone);
}

function utcFromWall(parts: number[], timeZone: string): Date {
  const [year, month, day, hour, minute, second] = parts;
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = wall - zoneOffsetMs(new Date(wall), timeZone);
  return new Date(wall - zoneOffsetMs(new Date(first), timeZone));
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', zoneFormat(timeZone)).formatToParts(instant);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour') % 24, pick('minute'), pick('second'));
  return asUtc - instant.getTime();
}

function zoneFormat(timeZone: string): Intl.DateTimeFormatOptions {
  return {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
}

export function uploadStamp(clock: Date): string {
  return serverCaptureTimestamp(clock);
}
