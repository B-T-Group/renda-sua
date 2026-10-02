import type { HasuraSystemService } from '../hasura/hasura-system.service';

export type CatalogLocationPhoneGate = {
  address?: { country?: string | null } | null;
  mobile_payment_phone?: { is_verified?: boolean } | null;
  pay_at_confirm?: boolean | null;
};

export async function fetchStripeEnabledCountries(
  hasura: HasuraSystemService
): Promise<string[]> {
  const res = await hasura.executeQuery(
    `query StripeCountries {
      supported_payment_systems(
        where: { name: { _eq: "stripe" }, active: { _eq: true } }
      ) { country }
    }`
  );
  return (res.supported_payment_systems ?? [])
    .map((row: { country?: string }) =>
      String(row.country ?? '').trim().toUpperCase()
    )
    .filter(Boolean);
}

/** MoMo locations need a verified registry phone; Stripe-country locations are exempt. */
export function isLocationPaymentsEnabled(
  location: CatalogLocationPhoneGate | null | undefined,
  stripeCountries: string[]
): boolean {
  if (!location) return false;
  if (location.mobile_payment_phone?.is_verified === true) return true;
  const country = location.address?.country?.trim().toUpperCase();
  if (!country) return false;
  return stripeCountries.includes(country);
}

/** @deprecated Use isLocationPaymentsEnabled */
export const isLocationPublicCatalogEligible = isLocationPaymentsEnabled;

/**
 * Optional storefront badge: location opted into "pay after the store confirms", the
 * platform kill switch is on, and the location is on the mobile-money rail
 * (Stripe-country locations never show it).
 */
export function isPayAfterConfirmBadgeVisible(
  location: CatalogLocationPhoneGate | null | undefined,
  stripeCountries: string[],
  killSwitchEnabled: boolean
): boolean {
  if (!killSwitchEnabled || location?.pay_at_confirm !== true) return false;
  const country = location.address?.country?.trim().toUpperCase();
  if (country && stripeCountries.includes(country)) return false;
  return true;
}
