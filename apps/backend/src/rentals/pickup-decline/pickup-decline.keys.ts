import { inspectionKeyRoot } from '../inspection/rental-inspection-evidence';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function declinePendingKey(bookingId: string, photoId: string, ext: string): string {
  const root = inspectionKeyRoot();
  return `${root}/rental-inspection/decline/pending/${bookingId.toLowerCase()}/${photoId.toLowerCase()}.${ext}`;
}

export function declineFinalKey(bookingId: string, photoId: string, ext: string): string {
  const root = inspectionKeyRoot();
  return `${root}/rental-inspection/decline/${bookingId.toLowerCase()}/${photoId.toLowerCase()}.${ext}`;
}

export function isDeclineEvidenceKey(raw: unknown, bookingId: string): boolean {
  if (typeof raw !== 'string' || raw.includes('/pending/') || !UUID_RE.test(bookingId)) return false;
  const match = /^(dev|prod)\/rental-inspection\/decline\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/i.exec(raw);
  return !!match && match[2].toLowerCase() === bookingId.toLowerCase() && UUID_RE.test(match[3]);
}

/** Public listing photos. Pickup, return, and decline keys never match. */
export function isPublicBaselineKey(raw: unknown, itemId: string): boolean {
  if (typeof raw !== 'string' || !UUID_RE.test(itemId)) return false;
  if (raw.includes('/decline/') || raw.includes('/pending/')) return false;
  const match = /^(dev|prod)\/rental-inspection\/baseline\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/i.exec(raw);
  return !!match && match[2].toLowerCase() === itemId.toLowerCase();
}
