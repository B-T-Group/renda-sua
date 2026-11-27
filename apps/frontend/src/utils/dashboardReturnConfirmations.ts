import type { BusinessReturnConfirmationRow } from '../hooks/useRentalApi';
import { confirmationTimeZone } from './rentals/confirmationFormat';
import { showBusinessReturnReport } from './rentalInspection';
import { formatReturnStamp } from './renterReturnPhase';

export interface ReturnCardModel {
  itemName: string;
  renterName: string;
  place: string;
  reportedStamp: string;
}

/** Rows the business still has to confirm, oldest report first. */
export function pendingReturnConfirmations(
  rows: BusinessReturnConfirmationRow[],
  flagOn: boolean
): BusinessReturnConfirmationRow[] {
  return rows
    .filter((row) => showBusinessReturnReport(flagOn, row.status, row.renter_reported_returned_at))
    .sort((a, b) => Date.parse(a.renter_reported_returned_at) - Date.parse(b.renter_reported_returned_at));
}

export function buildReturnCardModel(row: BusinessReturnConfirmationRow, language: string): ReturnCardModel {
  const listing = row.rental_location_listing;
  const user = row.client?.user;
  const zone = confirmationTimeZone(
    listing.business_location?.address?.country,
    row.currency || listing.rental_item.currency
  );
  return {
    itemName: listing.rental_item.name,
    renterName: [user?.first_name, user?.last_name].filter(Boolean).join(' '),
    place: listing.business_location?.name?.trim() || '',
    reportedStamp: formatReturnStamp(row.renter_reported_returned_at, language, zone),
  };
}
