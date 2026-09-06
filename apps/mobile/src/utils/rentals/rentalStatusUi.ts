import type { Theme } from '../../theme';
import type { BusinessRentalItemRow } from '../../types/rentals';

export type RentalModerationFilter = 'rejected' | 'proposal_pending';

function activeListings(
  listings: Array<{ moderation_status?: string | null; deleted_at?: string | null; id?: string }>
) {
  return listings.filter((l) => !l.deleted_at);
}

export function rentalItemMatchesModerationFilter(
  item: BusinessRentalItemRow,
  status: RentalModerationFilter
): boolean {
  return activeListings(item.rental_location_listings ?? []).some(
    (l) => l.moderation_status === status
  );
}

export function findFirstProposalPendingListingId(
  item: Pick<BusinessRentalItemRow, 'rental_location_listings'>
): string | null {
  const pending = activeListings(item.rental_location_listings ?? []).find(
    (l) => l.moderation_status === 'proposal_pending' && l.id
  );
  return pending?.id ?? null;
}

export function rentalRequestStatusColors(
  status: string,
  colors: Theme['colors']
): { backgroundColor: string; textColor: string; borderColor: string } {
  switch (status) {
    case 'pending':
      return {
        backgroundColor: colors.warning.main + '22',
        textColor: colors.warning.dark ?? colors.warning.main,
        borderColor: colors.warning.main + '55',
      };
    case 'available':
      return {
        backgroundColor: colors.success.main + '22',
        textColor: colors.success.dark ?? colors.success.main,
        borderColor: colors.success.main + '55',
      };
    case 'unavailable':
    case 'cancelled':
      return {
        backgroundColor: colors.error.main + '18',
        textColor: colors.error.main,
        borderColor: colors.error.main + '44',
      };
    case 'booked':
      return {
        backgroundColor: colors.info.main + '22',
        textColor: colors.info.dark ?? colors.info.main,
        borderColor: colors.info.main + '55',
      };
    default:
      return {
        backgroundColor: colors.divider,
        textColor: colors.text.secondary,
        borderColor: colors.divider,
      };
  }
}

export function rentalBookingStatusColors(
  status: string,
  colors: Theme['colors']
): { backgroundColor: string; textColor: string; borderColor: string } {
  switch (status) {
    case 'confirmed':
    case 'active':
      return {
        backgroundColor: colors.success.main + '22',
        textColor: colors.success.dark ?? colors.success.main,
        borderColor: colors.success.main + '55',
      };
    case 'proposed':
    case 'reserved':
    case 'awaiting_return':
      return {
        backgroundColor: colors.warning.main + '22',
        textColor: colors.warning.dark ?? colors.warning.main,
        borderColor: colors.warning.main + '55',
      };
    case 'completed':
      return {
        backgroundColor: colors.info.main + '18',
        textColor: colors.info.main,
        borderColor: colors.info.main + '44',
      };
    case 'cancelled':
      return {
        backgroundColor: colors.error.main + '18',
        textColor: colors.error.main,
        borderColor: colors.error.main + '44',
      };
    default:
      return {
        backgroundColor: colors.divider,
        textColor: colors.text.secondary,
        borderColor: colors.divider,
      };
  }
}

export function rentalListingModerationColors(
  status: string | null | undefined,
  colors: Theme['colors']
): { backgroundColor: string; textColor: string; borderColor: string } {
  switch (status) {
    case 'approved':
      return {
        backgroundColor: colors.success.main + '22',
        textColor: colors.success.dark ?? colors.success.main,
        borderColor: colors.success.main + '55',
      };
    case 'rejected':
      return {
        backgroundColor: colors.error.main + '18',
        textColor: colors.error.main,
        borderColor: colors.error.main + '44',
      };
    case 'proposal_pending':
      return {
        backgroundColor: colors.info.main + '22',
        textColor: colors.info.dark ?? colors.info.main,
        borderColor: colors.info.main + '55',
      };
    case 'draft':
      return {
        backgroundColor: colors.divider,
        textColor: colors.text.secondary,
        borderColor: colors.divider,
      };
    case 'ai_reviewing':
    case 'pending':
    default:
      return {
        backgroundColor: colors.warning.main + '22',
        textColor: colors.warning.dark ?? colors.warning.main,
        borderColor: colors.warning.main + '55',
      };
  }
}

export function rentalListingModerationLabelKey(
  status: string | null | undefined
): string {
  switch (status) {
    case 'approved':
      return 'business.rentals.moderation.approved';
    case 'rejected':
      return 'business.rentals.moderation.rejected';
    case 'proposal_pending':
      return 'business.rentals.moderation.proposalPending';
    case 'ai_reviewing':
      return 'business.rentals.moderation.aiReviewing';
    case 'draft':
      return 'business.rentals.moderation.draft';
    case 'pending':
    default:
      return 'business.rentals.moderation.pending';
  }
}

/** Aggregate listing moderation for catalog cards: rejected wins over pending. */
export function aggregateListingModerationStatus(
  listings: Array<{ moderation_status?: string | null; deleted_at?: string | null }>
):
  | 'rejected'
  | 'pending'
  | 'approved'
  | 'proposal_pending'
  | 'ai_reviewing'
  | 'draft'
  | null {
  const active = listings.filter((l) => !l.deleted_at);
  if (!active.length) return null;
  if (active.some((l) => l.moderation_status === 'rejected')) return 'rejected';
  if (active.some((l) => l.moderation_status === 'proposal_pending')) {
    return 'proposal_pending';
  }
  if (active.some((l) => l.moderation_status === 'ai_reviewing')) {
    return 'ai_reviewing';
  }
  if (active.some((l) => (l.moderation_status ?? 'pending') === 'pending')) {
    return 'pending';
  }
  if (active.some((l) => l.moderation_status === 'draft')) return 'draft';
  if (active.every((l) => l.moderation_status === 'approved')) return 'approved';
  return 'pending';
}

function isFutureIso(iso: string | null | undefined): boolean {
  if (!iso?.trim()) return false;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) && ms > Date.now();
}

/** True when an `available` request can still be booked (contract not expired). */
export function isProposedContractOpen(row: {
  status: string;
  expires_at?: string | null;
  rental_booking?: {
    status: string;
    contract_expires_at?: string | null;
  } | null;
}): boolean {
  if (row.status !== 'available') return false;
  const b = row.rental_booking;
  if (b?.status === 'proposed') {
    if (b.contract_expires_at) return isFutureIso(b.contract_expires_at);
    // Proposed booking without expiry: still treat request expires_at as the gate.
  }
  if (row.expires_at) return isFutureIso(row.expires_at);
  // No expiry on request or booking — allow book (server will enforce).
  return true;
}
