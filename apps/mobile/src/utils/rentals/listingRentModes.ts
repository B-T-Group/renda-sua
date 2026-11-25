/**
 * Which prices a renter should see for a listing (rentals_day_hours_picker_enabled switches).
 * Missing switches (older API) read as both on, so nothing changes for existing listings.
 */
export function listingRentModes(listing: { offers_daily?: boolean | null; offers_hourly?: boolean | null } | null | undefined): {
  daily: boolean;
  hourly: boolean;
} {
  const daily = listing?.offers_daily !== false;
  const hourly = listing?.offers_hourly !== false || !daily;
  return { daily, hourly };
}
