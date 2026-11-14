import { marketTimeZone } from '../../common/market-timezones';
import { isoCountryCode } from '../../orders/delivery-pricing.util';

export const PICKUP_PHOTO_RULES_FLAG = 'rentals_pickup_photo_rules_enabled';
export const PICKUP_PHOTO_AFTER_START = 'PICKUP_PHOTO_AFTER_START';
export const PICKUP_PHOTO_APP_ONLY = 'PICKUP_PHOTO_APP_ONLY';
export const PICKUP_PHOTO_SLOT_REQUIRED = 'PICKUP_PHOTO_SLOT_REQUIRED';
export const PICKUP_GUIDE_RETAKE_REQUIRED = 'PICKUP_GUIDE_RETAKE_REQUIRED';
export const PICKUP_GUIDE_SLOT_REQUIRED = 'PICKUP_GUIDE_SLOT_REQUIRED';
export const PICKUP_GUIDE_SKIP_REASON = 'PICKUP_GUIDE_SKIP_REASON';

const REQUIRED_SLOTS = ['overview', 'other_side', 'accessories'] as const;
const SLOT_KEY = /^(overview|other_side|accessories|extra:[1-9]\d{0,2})$/;
const FALLBACK_ZONE = 'Africa/Douala';

export type GuideRole = 'overview' | 'other_side' | 'accessories' | 'wear';

export interface GuideSlot {
  slotKey: string;
  role: GuideRole;
  required: boolean;
  mediaId: string;
}

export interface GuidePhoto {
  id: string;
  role: string;
  createdAt: string;
}

export interface SlotGap {
  unitId: string;
  slotKey: string;
  required: boolean;
}

/** Listing market zone. An unknown country uses Africa/Douala, matching rental search. */
export function listingTimeZone(country: string | null | undefined): string {
  return marketTimeZone(isoCountryCode(country)) ?? FALLBACK_ZONE;
}

export function calendarDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** Pickup day is the calendar day of start_at in the listing timezone. */
export function isPickupPhotoDay(startAt: Date, now: Date, timeZone: string): boolean {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(now.getTime())) return false;
  return calendarDay(startAt, timeZone) === calendarDay(now, timeZone);
}

/** Photos can be added until the rental start instant. The start instant itself is closed. */
export function isBeforeRentalStart(startAt: Date, now: Date): boolean {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(now.getTime())) return false;
  return now.getTime() < startAt.getTime();
}

export function parseSlotKey(value: string | null | undefined): string | null {
  const key = (value ?? '').trim();
  return SLOT_KEY.test(key) ? key : null;
}

export function isRequiredSlot(slotKey: string): boolean {
  return (REQUIRED_SLOTS as readonly string[]).includes(slotKey);
}

/** Server clock at upload receipt. Used when the photo has no EXIF time. */
export function serverCaptureTimestamp(clock: Date): string {
  return clock.toISOString();
}

export interface CaptureColumns {
  captured_at: string;
  slot_key: string | null;
  capture_source: 'camera' | 'gallery' | null;
  captured_at_source: 'exif' | 'upload' | null;
}

/** Flag off keeps the server clock and leaves the new columns null. */
export function captureColumns(input: {
  slotKey: string | null | undefined;
  clock: Date;
  timeZone: string;
  exif: string | null | undefined;
  source: string | null | undefined;
  rulesOn: boolean;
}): CaptureColumns {
  const slot_key = parseSlotKey(input.slotKey);
  if (!input.rulesOn) return flagOffColumns(input.clock, slot_key);
  const exifAt = parseExifCapture(input.exif, input.timeZone);
  return {
    captured_at: (exifAt ?? input.clock).toISOString(),
    slot_key,
    capture_source: normalizeSource(input.source),
    captured_at_source: exifAt ? 'exif' : 'upload',
  };
}

function flagOffColumns(clock: Date, slotKey: string | null): CaptureColumns {
  return {
    captured_at: serverCaptureTimestamp(clock),
    slot_key: slotKey,
    capture_source: null,
    captured_at_source: null,
  };
}

function normalizeSource(source: string | null | undefined): 'camera' | 'gallery' | null {
  if (source === 'camera' || source === 'gallery') return source;
  return null;
}

/** EXIF DateTimeOriginal. A value with no offset is read in the listing timezone. */
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
  const parts = match.slice(1).map((part) => Number(part));
  return utcFromWall(parts, timeZone);
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

/**
 * UX gate only. `ios`, `android`, and `mobile` count as the app; anything else, including a
 * missing header, counts as web. A caller can spoof `x-rendasua-platform`. This is not proof
 * the photo came from the camera. Freshness uses the server clock.
 */
export function uploadPlatform(header: string | string[] | undefined): 'app' | 'web' {
  const raw = Array.isArray(header) ? header[0] : header;
  const value = (raw ?? '').toLowerCase().trim();
  if (value === 'ios' || value === 'android' || value === 'mobile') return 'app';
  return 'web';
}

export function slotMatchesRole(slotKey: string, role: string): boolean {
  const key = parseSlotKey(slotKey);
  if (!key) return false;
  return key.startsWith('extra:') ? role === 'wear' : role === key;
}

/** First photo of each required role keeps that slot. Later photos become extra:N. */
export function assignGuideSlots(photos: GuidePhoto[]): GuideSlot[] {
  const rows = [...photos]
    .filter((photo) => photo.role !== 'counter')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const used = new Set<string>();
  let extra = 0;
  return rows.map((photo) => toGuideSlot(photo, used, () => ++extra));
}

function toGuideSlot(photo: GuidePhoto, used: Set<string>, nextExtra: () => number): GuideSlot {
  if ((REQUIRED_SLOTS as readonly string[]).includes(photo.role) && !used.has(photo.role)) {
    used.add(photo.role);
    return { slotKey: photo.role, role: photo.role as GuideRole, required: true, mediaId: photo.id };
  }
  return { slotKey: `extra:${nextExtra()}`, role: 'wear', required: false, mediaId: photo.id };
}

/** The default angle set stays required even when the last report omitted one. */
export function completeGuideSlots(assigned: GuideSlot[]): GuideSlot[] {
  const required = REQUIRED_SLOTS.map((role) => {
    return assigned.find((slot) => slot.slotKey === role) ?? emptyRequired(role);
  });
  return [...required, ...assigned.filter((slot) => !slot.required)];
}

function emptyRequired(role: (typeof REQUIRED_SLOTS)[number]): GuideSlot {
  return { slotKey: role, role, required: true, mediaId: '' };
}

export function canonicalUnitId(units: Array<{ unitId: string; slotIndex: number; photoCount: number }>): string | null {
  const withPhotos = units.filter((unit) => unit.photoCount > 0);
  const pool = withPhotos.length ? withPhotos : units;
  const sorted = [...pool].sort((a, b) => a.slotIndex - b.slotIndex || a.unitId.localeCompare(b.unitId));
  return sorted[0]?.unitId ?? null;
}

export function guideChecklist(item: {
  condition?: string | null;
  accessories?: unknown;
  wear?: string | null;
  checklist_note?: string | null;
}) {
  if (item.condition !== 'good' && item.condition !== 'fair' && item.condition !== 'damaged') return null;
  const note = item.checklist_note?.trim() || null;
  const tags = note ? ['condition', 'accessories', 'wear', 'notes'] : ['condition', 'accessories', 'wear'];
  return {
    tags,
    checkCount: tags.length,
    set: {
      condition: item.condition,
      accessories: Array.isArray(item.accessories) ? item.accessories : [],
      wear: item.wear?.trim() || 'none',
      checklist_note: note,
      guide_unconfirmed: tags,
    },
  };
}

export function missingGuideSlots(
  slots: Array<{ slotKey: string; required: boolean }>,
  photos: Array<{ unitId: string; slotKey: string | null; status: string }>,
  skips: Array<{ unitId: string; slotKey: string; reason: string }>,
  unitIds: string[]
): SlotGap[] {
  const missing: SlotGap[] = [];
  for (const unitId of unitIds) {
    for (const slot of slots) missing.push(...gapFor(unitId, slot, photos, skips));
  }
  return missing;
}

function gapFor(
  unitId: string,
  slot: { slotKey: string; required: boolean },
  photos: Array<{ unitId: string; slotKey: string | null; status: string }>,
  skips: Array<{ unitId: string; slotKey: string; reason: string }>
): SlotGap[] {
  const taken = photos.some((photo) => photo.unitId === unitId && photo.slotKey === slot.slotKey && photo.status === 'ready');
  const skipped = !slot.required && skips.some((row) => sameSkip(row, unitId, slot.slotKey));
  if (taken || skipped) return [];
  return [{ unitId, slotKey: slot.slotKey, required: slot.required }];
}

function sameSkip(row: { unitId: string; slotKey: string; reason: string }, unitId: string, slotKey: string): boolean {
  return row.unitId === unitId && row.slotKey === slotKey && !!row.reason.trim();
}

/** True when a stored capture date falls on a different listing-timezone day than start_at. */
export function photoOffPickupDay(capturedAt: string | null, startAt: Date, timeZone: string): boolean {
  if (!capturedAt) return false;
  const at = new Date(capturedAt);
  if (Number.isNaN(at.getTime()) || Number.isNaN(startAt.getTime())) return false;
  return calendarDay(at, timeZone) !== calendarDay(startAt, timeZone);
}

/** Drop ASCII control characters, then trim. Length is capped by skipDecision. */
export function cleanSkipReason(reason: string): string {
  return reason.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function skipDecision(slotKey: string, reason: string, allowed: string[]): 'ok' | 'required' | 'reason' {
  const key = parseSlotKey(slotKey);
  if (!key || isRequiredSlot(key) || !allowed.includes(key)) return 'required';
  const text = cleanSkipReason(reason);
  if (!text || text.length > 280) return 'reason';
  return 'ok';
}
