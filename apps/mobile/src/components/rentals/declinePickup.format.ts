import { formatConfirmationMoney } from '../../utils/rentals/confirmationFormat';
import { formatListingDay } from '../../utils/rentals/pickupPhotoTime';

/** Stripe CAD and Mobile Money FCFA, from the shared confirmation formatter. */
export function declineAmount(amount: number, currency: string, language: string): string {
  return formatConfirmationMoney(amount, currency, language);
}

/** Short day in the listing timezone: `14 Nov` / `14 nov.`. */
export function declineDay(iso: string, timeZone: string, language: string): string {
  return formatListingDay(iso, timeZone, language);
}

export function momoRail(currency: string, rail: string): boolean {
  const code = currency.toUpperCase();
  return rail === 'momo_paid' || rail === 'momo_unpaid' || code === 'XAF' || code === 'XOF';
}
