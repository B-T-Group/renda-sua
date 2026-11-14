import { formatDoualaStamp } from './renterReturnPhase';

/**
 * A real UTC instant for an admin rental list, shown on the Africa/Douala clock.
 * Listing due times stay on formatListingDue, which reads a stored wall clock.
 */
export function formatAdminDoualaTime(iso: string, language: string): string {
  return formatDoualaStamp(iso, language);
}
