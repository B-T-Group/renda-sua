/** Designated agent first: pure helpers shared by the web agent screens. The server stays the authority. */

export const DESIGNATED_DECLINE_REASONS = ['too_far', 'busy', 'not_enough_balance', 'other'] as const;
export type DesignatedDeclineReason = (typeof DESIGNATED_DECLINE_REASONS)[number];

export interface DesignatedOfferDetails {
  date: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  gateAt: string | null;
  businessName: string;
  pickupArea: string;
  dropoffArea: string;
  pickupKm: number | null;
  dropoffKm: number | null;
  distanceOrigin: 'gps' | 'home' | null;
  commission: number | null;
  currency: string | null;
  releaseCutoffAt: string | null;
}

export interface DesignatedOffer {
  orderId: string;
  phase: string;
  expiresAt: string;
  offeredAt: string;
  estimatedEarnings: number | null;
  currency: string | null;
  details: DesignatedOfferDetails | null;
}

export interface DesignatedUpcoming {
  orderId: string;
  orderNumber: string;
  storeName: string | null;
  date: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  pickupBy: string | null;
  gateAt: string | null;
  releaseCutoffAt: string | null;
  freeRelease: boolean;
  confirmedAt: string | null;
}

export interface DesignatedMine {
  offers: DesignatedOffer[];
  upcoming: DesignatedUpcoming[];
}

export function formatDateTime(iso: string | null | undefined, locale?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatWindow(start: string | null | undefined, end: string | null | undefined): string {
  const hm = (s: string | null | undefined) => (s ? s.slice(0, 5) : '');
  if (!start && !end) return '';
  return `${hm(start)}–${hm(end)}`;
}

export function formatKmShort(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '';
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function isFreeRelease(up: Pick<DesignatedUpcoming, 'releaseCutoffAt'>, nowMs: number = Date.now()): boolean {
  if (!up.releaseCutoffAt) return false;
  const t = new Date(up.releaseCutoffAt).getTime();
  return Number.isFinite(t) && t > nowMs;
}

/** Server message from an axios error (`response.data.message`), else null. */
export function apiErrorMessage(err: unknown): string | null {
  const e = err as { response?: { data?: { message?: unknown } } } | null;
  const m = e?.response?.data?.message;
  return typeof m === 'string' && m.trim() ? m : null;
}
