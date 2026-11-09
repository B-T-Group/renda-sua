/** One in-flight mobile-money attempt per booking and purpose. */
export function rentalMomoIdempotencyKey(
  bookingNumber: string,
  purpose: 'contract' | 'overtime'
): string {
  return `rental-momo:${bookingNumber}:${purpose}`;
}

/** A provider prompt older than this can be replaced. Matches the ~5 minute MoMo prompt. */
export const RENTAL_MOMO_PENDING_MAX_AGE_MS = 5 * 60 * 1000;

/** Unique alphanumeric provider reference. `reference` is unique and callbacks look it up. */
export function newRentalMomoReference(
  purpose: 'contract' | 'overtime',
  now = Date.now()
): string {
  const tag = purpose === 'overtime' ? 'o' : 'c';
  const stamp = now.toString().slice(-8);
  const random = Math.random().toString(36).slice(2, 6);
  return `${tag}${stamp}${random}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
}

/** Hasura surfaces unique-index violations as "Uniqueness violation". */
export function isRentalMomoUniqueViolation(error: unknown): boolean {
  const text = JSON.stringify(
    (error as { response?: unknown; message?: unknown })?.response ??
      (error as { message?: unknown })?.message ??
      error ??
      ''
  ).toLowerCase();
  return text.includes('uniqueness violation') || text.includes('duplicate key');
}

export function decideRentalMomoRetry(
  existing: {
    status: string;
    transaction_id?: string | null;
    created_at?: string | null;
  } | null,
  now = Date.now(),
  maxAgeMs = RENTAL_MOMO_PENDING_MAX_AGE_MS
): 'send' | 'skip' | 'replace' {
  if (!existing) return 'send';
  if (existing.status === 'success') return 'skip';
  const created = existing.created_at ? new Date(existing.created_at).getTime() : now;
  const stale = Number.isFinite(created) && now - created >= maxAgeMs;
  if (existing.status === 'pending' || existing.status === 'processing') {
    if (stale) return 'replace';
    if (existing.transaction_id || existing.status === 'processing') return 'skip';
    return 'send';
  }
  return 'replace';
}
