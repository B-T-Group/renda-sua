import { normalizeLanguage } from '../notifications/email-template-data';
import type { DedicatedReleaseRefusal } from './order-reassignment.service';

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

const RELEASE_REFUSAL_COPY: Record<DedicatedReleaseRefusal, { en: string; fr: string }> = {
  unavailable: {
    en: 'This order cannot be released.',
    fr: 'Cette commande ne peut pas être libérée.',
  },
  dedicated_disabled: {
    en: 'Dedicated deliveries are turned off for now, so this order cannot be released.',
    fr: 'Les livraisons dédiées sont désactivées pour le moment : cette commande ne peut pas être libérée.',
  },
  not_assigned: {
    en: 'This order is no longer assigned to you, or it was already picked up.',
    fr: "Cette commande ne vous est plus attribuée, ou elle a déjà été récupérée.",
  },
  not_auto_assigned: {
    en: 'Only an order RendaSua assigned to you automatically can be released.',
    fr: 'Seule une commande que RendaSua vous a attribuée automatiquement peut être libérée.',
  },
  window_closed: {
    en: 'The 2 minutes to release this order are over.',
    fr: 'Les 2 minutes pour libérer cette commande sont écoulées.',
  },
  release_failed: {
    en: 'We could not release this order. Please try again.',
    fr: "Nous n'avons pas pu libérer cette commande. Veuillez réessayer.",
  },
};

/** #594 PR 6: the release refusal in the agent's saved language (default language otherwise). */
export function dedicatedReleaseRefusalMessage(
  refusal: DedicatedReleaseRefusal,
  preferredLanguage?: string | null
): string {
  const copy = RELEASE_REFUSAL_COPY[refusal];
  return normalizeLanguage(preferredLanguage) === 'fr' ? copy.fr : copy.en;
}
