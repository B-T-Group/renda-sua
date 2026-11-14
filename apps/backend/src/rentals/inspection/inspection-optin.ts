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

export function reuseChoice(input: {
  hasReturn: boolean;
  damage: ReuseBlock | null;
  hasBaseline: boolean;
}): { ok: true; source: 'return' | 'baseline' } | { ok: false; code: string } {
  if (input.hasReturn && input.damage) return { ok: false, code: PICKUP_REUSE_BLOCKED_DAMAGE };
  if (input.hasReturn) return { ok: true, source: 'return' };
  if (input.hasBaseline) return { ok: true, source: 'baseline' };
  return { ok: false, code: PICKUP_REUSE_UNAVAILABLE };
}

export function optInCaptureColumns(input: {
  slotKey?: string | null;
  clock: Date;
  timeZone: string;
  exif?: string | null;
  source?: string | null;
  platform?: string | string[];
}): CaptureColumns {
  const exifAt = parseExifCapture(input.exif, input.timeZone);
  return {
    captured_at: (exifAt ?? input.clock).toISOString(),
    slot_key: parseSlotKey(input.slotKey),
    capture_source: normalizeSource(input.source, input.platform),
    captured_at_source: exifAt ? 'exif' : 'upload',
    reused: false,
  };
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
    captured_at_source: knownAtSource(input.atSource),
    reused: true,
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
