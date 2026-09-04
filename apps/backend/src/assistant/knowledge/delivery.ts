import type { KnowledgeLocale } from './types';

const EN = `How delivery works on Rendasua:

- Orders can be fulfilled by delivery (agent/courier) or in-store pickup.
- Typical delivery messaging: about 6–24 hours depending on distance, merchant prep time, and market. Same-day options may be available where configured.
- Fees are calculated by distance; checkout shows the delivery fee before payment.
- Customers can track delivery progress in the app once an agent is assigned.
- Delivery is available in supported markets (Gabon, Cameroon, Canada) where delivery_enabled is on for the location.
- For payment at delivery: supported for mobile-money markets when the merchant allows it; not available for Stripe-rail sellers.`;

const FR = `Comment fonctionne la livraison sur Rendasua :

- Les commandes peuvent être livrées (agent/coursier) ou retirées en magasin.
- Délai typique annoncé : environ 6–24 h selon la distance, le temps de préparation du commerçant et le marché. Des options le jour même peuvent exister selon la configuration.
- Les frais sont calculés selon la distance ; le checkout les affiche avant paiement.
- Le client peut suivre la livraison dans l'application une fois un agent assigné.
- La livraison est disponible dans les marchés supportés (Gabon, Cameroun, Canada) lorsque la livraison est activée pour le lieu.
- Paiement à la livraison : disponible sur les marchés mobile money lorsque le commerçant l'autorise ; non disponible pour les vendeurs sur le rail Stripe.`;

export function getDeliveryKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
