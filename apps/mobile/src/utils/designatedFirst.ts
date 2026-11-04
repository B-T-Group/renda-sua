/**
 * Designated agent first: pure helpers (no React) for the early offer, the upcoming list and
 * "Still on it" / "Can't make it". The server stays the authority on every rule.
 */
import type { DesignatedMineResponse, DesignatedOffer, DesignatedUpcoming } from '../types/designated';

/** Offers valid longer than this are early designated offers: show "Accept before …" instead of a ring. */
export const LONG_OFFER_THRESHOLD_SECONDS = 30 * 60;

export function isLongOffer(expiresAt: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return false;
  return (t - nowMs) / 1000 > LONG_OFFER_THRESHOLD_SECONDS;
}

/** Locale date + time, e.g. "Thu 5 Nov, 08:00". Empty for missing/invalid input. */
export function formatDateTime(iso: string | null | undefined, locale?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "HH:MM–HH:MM" from slot times ("08:00:00"), empty when unknown. */
export function formatWindow(start: string | null | undefined, end: string | null | undefined): string {
  const hm = (s: string | null | undefined) => (s ? s.slice(0, 5) : '');
  if (!start && !end) return '';
  return `${hm(start)}–${hm(end)}`;
}

/** "1.2 km" or "". */
export function formatKmShort(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '';
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export type DesignatedEntry =
  | { kind: 'offer'; offer: DesignatedOffer }
  | { kind: 'upcoming'; upcoming: DesignatedUpcoming }
  | null;

/** Find this order in the agent's designated list. An assignment wins over a stale offer. */
export function findDesignated(list: DesignatedMineResponse | null | undefined, orderId: string | null | undefined): DesignatedEntry {
  if (!list || !orderId) return null;
  const up = list.upcoming?.find((u) => u.orderId === orderId);
  if (up) return { kind: 'upcoming', upcoming: up };
  const offer = list.offers?.find((o) => o.orderId === orderId);
  return offer ? { kind: 'offer', offer } : null;
}

/** Free release until the cutoff; after it "Can't make it" is a strike (no money). */
export function isFreeRelease(up: Pick<DesignatedUpcoming, 'releaseCutoffAt'>, nowMs: number = Date.now()): boolean {
  if (!up.releaseCutoffAt) return false;
  const t = new Date(up.releaseCutoffAt).getTime();
  return Number.isFinite(t) && t > nowMs;
}

export type DesignatedActionFailure = { kind: 'refresh' | 'retry' | 'other'; message: string | null };

/** Map a failed designated-confirm / designated-release (apiClient errors carry `code` and `status`). */
export function classifyDesignatedError(err: unknown): DesignatedActionFailure {
  const e = (err ?? {}) as { code?: string; status?: number; message?: string };
  const message = typeof e.message === 'string' && e.message.trim() ? e.message : null;
  if (e.status === 409 || e.status === 404) return { kind: 'refresh', message };
  if (e.code === 'DEDICATED_RELEASE_FAILED' || e.status === 500) return { kind: 'retry', message };
  return { kind: 'other', message };
}
