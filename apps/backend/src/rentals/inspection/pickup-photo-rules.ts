import { marketTimeZone } from '../../common/market-timezones';
import { isoCountryCode } from '../../orders/delivery-pricing.util';

export const PICKUP_PHOTO_RULES_FLAG = 'rentals_pickup_photo_rules_enabled';
export const PICKUP_PHOTO_NOT_PICKUP_DAY = 'PICKUP_PHOTO_NOT_PICKUP_DAY';
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

export function parseSlotKey(value: string | null | undefined): string | null {
  const key = (value ?? '').trim();
  return SLOT_KEY.test(key) ? key : null;
}

export function isRequiredSlot(slotKey: string): boolean {
  return (REQUIRED_SLOTS as readonly string[]).includes(slotKey);
}

/** Server clock at upload receipt. The client timestamp is not a parameter. */
export function serverCaptureTimestamp(clock: Date): string {
  return clock.toISOString();
}

export function pendingMediaColumns(slotKey: string | null | undefined, clock: Date) {
  return { captured_at: serverCaptureTimestamp(clock), slot_key: parseSlotKey(slotKey) };
}

/** ios/android are the app. A missing header is web, so a browser cannot claim the camera. */
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

export function captureOutsidePickupDay(
  photos: Array<{ capturedAt: string | null }>,
  startAt: Date,
  timeZone: string
): boolean {
  const day = calendarDay(startAt, timeZone);
  return photos.some((photo) => outsideDay(photo.capturedAt, day, timeZone));
}

function outsideDay(capturedAt: string | null, day: string, timeZone: string): boolean {
  if (!capturedAt) return true;
  const at = new Date(capturedAt);
  return Number.isNaN(at.getTime()) || calendarDay(at, timeZone) !== day;
}

export function skipDecision(slotKey: string, reason: string, allowed: string[]): 'ok' | 'required' | 'reason' {
  const key = parseSlotKey(slotKey);
  if (!key || isRequiredSlot(key) || !allowed.includes(key)) return 'required';
  const text = reason.trim();
  if (!text || text.length > 280) return 'reason';
  return 'ok';
}
