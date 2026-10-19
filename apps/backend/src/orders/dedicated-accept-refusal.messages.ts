import { normalizeLanguage } from '../notifications/email-template-data';

/** Client-facing codes on a refused dedicated accept (409 DEDICATED_OFFER_INELIGIBLE). */
export const DEDICATED_ACCEPT_REFUSAL_CODES = {
  disabled: 'DEDICATED_DISABLED',
  ineligible: 'DEDICATED_OFFER_INELIGIBLE',
} as const;

/**
 * #594 PR 5: code plus a message in the agent's language (default language
 * when none is saved, the same rule as the dedicated notices).
 */
export function dedicatedAcceptRefusal(
  reason: string,
  preferredLanguage?: string | null
): { code: string; message: string } {
  const fr = normalizeLanguage(preferredLanguage) === 'fr';
  if (reason === 'dedicated_disabled') {
    return {
      code: DEDICATED_ACCEPT_REFUSAL_CODES.disabled,
      message: fr
        ? "Les livraisons dédiées sont désactivées pour le moment. Cette commande repasse par l'attribution habituelle."
        : 'Dedicated deliveries are turned off for now. This order goes back to the usual dispatch.',
    };
  }
  return {
    code: DEDICATED_ACCEPT_REFUSAL_CODES.ineligible,
    message: fr ? 'Vous ne pouvez plus prendre cette livraison dédiée.' : 'You can no longer take this dedicated delivery.',
  };
}
