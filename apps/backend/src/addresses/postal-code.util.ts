/**
 * Normalizes postal / ZIP for DB writes: missing or null → '', trims whitespace.
 */
export function postalCodeForStorage(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value).trim();
}
