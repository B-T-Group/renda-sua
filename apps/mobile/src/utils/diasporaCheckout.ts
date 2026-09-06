/**
 * Diaspora checkout utilities.
 *
 * Mirrors web `diasporaCheckout.ts` patterns for cross-border order UI rendering.
 * Do NOT hardcode country lists or payment-rail rules; consume backend preflight
 * response (`diaspora` field) as the single source of truth.
 */

import type { CheckoutDiaspora } from '../types/checkout';
import type { RecipientContact } from '../types/clientOrder';

/**
 * Check if this checkout is cross-border (payer and fulfillment in different countries).
 */
export function isCrossBorder(diaspora: CheckoutDiaspora | null | undefined): boolean {
  if (!diaspora?.is_diaspora) return false;
  const payer = diaspora.payer_country?.trim().toUpperCase();
  const fulfillment = diaspora.fulfillment_country?.trim().toUpperCase();
  return !!payer && !!fulfillment && payer !== fulfillment;
}

/**
 * Validate recipient contact for diaspora orders.
 * Returns null when valid, or an error key when invalid.
 */
export function validateRecipientContact(
  recipient: Partial<RecipientContact> | null | undefined
): 'missing_name' | 'missing_phone' | null {
  if (!recipient) return 'missing_name';
  const name = recipient.name?.trim();
  const phone = recipient.phone?.trim();
  if (!name || name.length === 0) return 'missing_name';
  if (!phone || phone.length === 0) return 'missing_phone';
  return null;
}

/**
 * Format the payer charge estimate for display (indicative FX line).
 * Returns a localized string or null if no estimate is available.
 */
export function formatPayerChargeEstimate(
  diaspora: CheckoutDiaspora | null | undefined,
  locale: string = 'en'
): string | null {
  const estimate = diaspora?.payer_charge_estimate;
  if (!estimate || !estimate.amount || !estimate.currency) return null;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: estimate.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(estimate.amount);
}

/**
 * Check if the order requires recipient contact details.
 */
export function requiresRecipientContact(
  diaspora: CheckoutDiaspora | null | undefined
): boolean {
  return diaspora?.requires_recipient_contact === true;
}

/**
 * True when "someone else is receiving" is on but name/phone are still empty.
 * Pay now must stay disabled in this state.
 */
export function isRecipientDraftIncomplete(
  someoneElseReceiving: boolean,
  recipient: Partial<RecipientContact> | null | undefined
): boolean {
  if (!someoneElseReceiving) return false;
  return validateRecipientContact(recipient) !== null;
}

/**
 * Build the recipient payload for order creation when someone-else is receiving.
 * Returns undefined if recipient is not needed or invalid.
 */
export function buildRecipientPayload(
  someoneElse: boolean,
  recipient: Partial<RecipientContact> | null | undefined
): RecipientContact | undefined {
  if (!someoneElse) return undefined;
  if (!recipient) return undefined;
  const validation = validateRecipientContact(recipient);
  if (validation !== null) return undefined;

  return {
    name: recipient.name!.trim(),
    phone: recipient.phone!.trim(),
    notify_whatsapp: recipient.notify_whatsapp ?? false,
  };
}

/**
 * Check if diaspora path is active and Stripe is required.
 * On diaspora orders, only Stripe pay-now is allowed (no MoMo, no cash).
 */
export function requiresStripePayNow(
  diaspora: CheckoutDiaspora | null | undefined
): boolean {
  return diaspora?.is_diaspora === true;
}

export function normalizeCountryIso(country: string | null | undefined): string {
  return (country ?? '').trim().toUpperCase();
}

/**
 * When someone else is receiving and fulfillment needs a drop-off, collect
 * an address in the fulfillment country (shared with the delivery agent).
 */
export function needsRecipientDeliveryAddress(
  someoneElseReceiving: boolean,
  fulfillmentNeedsDropOff: boolean
): boolean {
  return someoneElseReceiving && fulfillmentNeedsDropOff;
}

export function addressesInCountry<T extends { country?: string | null }>(
  addresses: T[],
  countryIso: string | null | undefined
): T[] {
  const want = normalizeCountryIso(countryIso);
  if (!want) return addresses;
  return addresses.filter((a) => normalizeCountryIso(a.country) === want);
}

/**
 * Drop-off addresses for delivery/shipping. Never include the payer's
 * out-of-country book (e.g. CA) when the goods can only go to CM/GA.
 * If the destination country is not known yet, return none so a foreign
 * primary address cannot flash in and poison preflight.
 */
export function dropOffAddressesForFulfillment<T extends { country?: string | null }>(
  addresses: T[],
  dropOffCountryIso: string | null | undefined,
  needsDropOff: boolean
): T[] {
  if (!needsDropOff) return addresses;
  const iso = normalizeCountryIso(dropOffCountryIso);
  if (!iso) return [];
  return addressesInCountry(addresses, iso);
}

export function usableDeliveryAddressId(
  addressId: string,
  dropOffAddresses: { id: string }[]
): string {
  if (addressId && dropOffAddresses.some((a) => a.id === addressId)) return addressId;
  return '';
}
