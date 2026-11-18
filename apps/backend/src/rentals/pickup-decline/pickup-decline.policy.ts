export const PICKUP_DECLINE_FLAG = 'rentals_pickup_decline_enabled';
export const DECLINE_FLAG_THRESHOLD = 5;
export const DECLINE_WINDOW_DAYS = 90;

export const DECLINE_REASONS = ['damaged', 'missing_accessory', 'not_the_item', 'other'] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export interface DeclineGuardBooking {
  status: string;
  actual_start_at: string | null;
  inspection_policy_version: number | null;
  pickup_current_version_id: string | null;
  pickup_accepted_version_id?: string | null;
}

export type DeclineGuard = 'ok' | 'not_inspected' | 'closed' | 'version' | 'accepted';

export const MAX_DECLINE_PHOTOS = 6;
export const FINANCIAL_REFUNDS_PERMISSION = 'platform.financial.refunds';

/** Open inspected bookings only. An accepted pickup report uses Report a problem. */
export function declineGuard(booking: DeclineGuardBooking, versionId: string): DeclineGuard {
  if (booking.inspection_policy_version == null) return 'not_inspected';
  if (booking.actual_start_at) return 'closed';
  if (booking.status !== 'reserved' && booking.status !== 'confirmed') return 'closed';
  if (
    booking.pickup_accepted_version_id &&
    booking.pickup_accepted_version_id === booking.pickup_current_version_id
  ) {
    return 'accepted';
  }
  if (!booking.pickup_current_version_id || booking.pickup_current_version_id !== versionId) {
    return 'version';
  }
  return 'ok';
}

export function refundMarkAllowed(access: { isSuperuser?: boolean; permissions?: string[] }): boolean {
  if (access.isSuperuser) return true;
  return (access.permissions ?? []).includes(FINANCIAL_REFUNDS_PERMISSION);
}

/** A manual refund records either the provider reference or a written note. */
export function refundMarkEvidence(providerRef?: string | null, note?: string | null): boolean {
  return Boolean((providerRef ?? '').trim() || (note ?? '').trim());
}

export function otherReasonText(reason: string, text: string | undefined): string | null {
  if (reason !== 'other') return null;
  const trimmed = (text ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isDeclineReason(value: string): value is DeclineReason {
  return (DECLINE_REASONS as readonly string[]).includes(value);
}

/** Full name, or the party id when either name is missing. */
export function renterPartyName(first?: string | null, last?: string | null, id?: string | null): string {
  const given = (first ?? '').trim();
  const family = (last ?? '').trim();
  if (given && family) return `${given} ${family}`;
  return (id ?? '').trim();
}
