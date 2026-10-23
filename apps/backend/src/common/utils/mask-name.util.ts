/**
 * Privacy-safe display names for public/semi-public lookups.
 * Never expose a full last name to unauthenticated callers.
 */

/** "Samuel Besong" -> "Samuel B."; "Samuel" -> "Samuel"; "" -> "". */
export function maskPersonName(
  firstName?: string | null,
  lastName?: string | null
): string {
  const first = (firstName ?? '').trim();
  const last = (lastName ?? '').trim();
  const initial = last ? `${Array.from(last)[0].toLocaleUpperCase()}.` : '';
  return [first, initial].filter(Boolean).join(' ');
}

/** "Rendasua Shop" + owner Samuel Besong -> "Rendasua Shop (Samuel B.)". */
export function businessDisplayWithMaskedOwner(
  businessName?: string | null,
  ownerFirstName?: string | null,
  ownerLastName?: string | null
): string {
  const name = (businessName ?? '').trim();
  const owner = maskPersonName(ownerFirstName, ownerLastName);
  if (!name) return owner;
  return owner ? `${name} (${owner})` : name;
}
