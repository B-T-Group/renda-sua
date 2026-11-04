import { DateTime } from 'luxon';

/** GPS fixes older than this fall back to the agent's home address (plan section 4). */
export const DESIGNATED_GPS_FRESH_MINUTES = 15;
/** SFN timing slack: a tick this early still counts as due. */
export const DESIGNATED_TICK_SLACK_MS = 90_000;
/** An early offer still `offered` this long past its expiry raises the stuck alarm. */
export const DESIGNATED_STUCK_OFFER_MS = 5 * 60_000;

export type DesignatedAction = 'open_offer_reminder' | 'evening_reminder' | 'soon_reminder';

export interface DesignatedTickState {
  now: Date;
  gateAt: Date | null;
  windowStart: Date | null;
  /** Store-local slot date (YYYY-MM-DD). */
  slotDate: string | null;
  timeZone: string | null;
  /** Order unassigned with at least one open early offer. */
  openEarlyOffer: boolean;
  openReminderSentAt: string | null;
  /** Assigned to the designated agent (accepted early or auto-assigned at ready). */
  designatedAssigned: boolean;
  acceptedAt: string | null;
  confirmedAt: string | null;
  eveningSentAt: string | null;
  soonSentAt: string | null;
  openOfferReminderMinutes: number;
  reminderMinutesBefore: number;
  eveningEnabled: boolean;
  eveningLocalMinutes: number;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function toPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

/** Origin for "distance to pickup": a fresh GPS fix, else the agent's home address (labelled). */
export function pickDistanceOrigin(
  gps: { lat: number; lng: number; updatedAt: string | null } | null,
  home: { lat: number; lng: number } | null,
  now: Date
): { point: { lat: number; lng: number }; source: 'gps' | 'home' } | null {
  if (gps?.updatedAt) {
    const age = now.getTime() - new Date(gps.updatedAt).getTime();
    if (age >= 0 && age <= DESIGNATED_GPS_FRESH_MINUTES * 60_000) return { point: gps, source: 'gps' };
  }
  if (home) return { point: home, source: 'home' };
  if (gps) return { point: gps, source: 'gps' };
  return null;
}

/** Last moment a release is free (no strike): window start minus the cutoff. */
export function designatedReleaseCutoffAt(windowStart: Date, cutoffMinutes: number): Date {
  return new Date(windowStart.getTime() - cutoffMinutes * 60_000);
}

/** The evening before the slot date at `localMinutes` (1140 = 19:00) in the store time zone. */
export function eveningBeforeAt(slotDate: string, localMinutes: number, timeZone: string): Date | null {
  const day = DateTime.fromISO(slotDate, { zone: timeZone });
  if (!day.isValid) return null;
  const at = day
    .minus({ days: 1 })
    .set({ hour: Math.floor(localMinutes / 60), minute: localMinutes % 60, second: 0, millisecond: 0 });
  return at.isValid ? at.toJSDate() : null;
}

function thresholds(s: DesignatedTickState): Record<DesignatedAction, Date | null> {
  const ms = (d: Date | null, minus: number) => (d ? new Date(d.getTime() - minus * 60_000) : null);
  const evening =
    s.eveningEnabled && s.slotDate && s.timeZone ? eveningBeforeAt(s.slotDate, s.eveningLocalMinutes, s.timeZone) : null;
  return {
    open_offer_reminder: s.openOfferReminderMinutes > 0 ? ms(s.gateAt, s.openOfferReminderMinutes) : null,
    evening_reminder: evening,
    soon_reminder: ms(s.windowStart, s.reminderMinutesBefore),
  };
}

/**
 * Which designated notices are due now, and when the next one becomes due
 * (null = nothing left to schedule). Each notice is sent at most once (its
 * *_sent_at column), so a duplicate or early tick is harmless.
 */
export function designatedDueActions(s: DesignatedTickState): { due: DesignatedAction[]; nextAt: Date | null } {
  const t = thresholds(s);
  const now = s.now.getTime() + DESIGNATED_TICK_SLACK_MS;
  const due: DesignatedAction[] = [];
  const future: number[] = [];
  const consider = (action: DesignatedAction, applies: boolean, until: Date | null) => {
    const at = t[action];
    if (!applies || !at) return;
    if (until && s.now.getTime() >= until.getTime()) return;
    if (at.getTime() <= now) due.push(action);
    else future.push(at.getTime());
  };
  consider('open_offer_reminder', s.openEarlyOffer && !s.openReminderSentAt, s.gateAt);
  const soonAt = t.soon_reminder;
  // The evening notice is pointless once the T-60 one is due, or if the agent accepted after it.
  const acceptedBeforeEvening =
    !!s.acceptedAt && !!t.evening_reminder && new Date(s.acceptedAt).getTime() < t.evening_reminder.getTime();
  consider(
    'evening_reminder',
    s.designatedAssigned && !s.confirmedAt && !s.eveningSentAt && acceptedBeforeEvening,
    soonAt
  );
  consider('soon_reminder', s.designatedAssigned && !s.soonSentAt, s.windowStart);
  return { due, nextAt: future.length > 0 ? new Date(Math.min(...future)) : null };
}

/** Delivery area shown before accepting: neighbourhood/city, never the street address. */
export function designatedArea(addr: { city?: string | null; state?: string | null } | null | undefined): string {
  return [addr?.city, addr?.state].map((v) => v?.trim()).filter(Boolean).join(', ') || '—';
}
