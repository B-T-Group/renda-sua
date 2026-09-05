import type { KnowledgeLocale } from './types';

const EN = `How delivery works on Rendasua:

- Orders can be fulfilled by delivery (agent/courier) or in-store pickup.
- **Store products**: Usually 24–48 hours from order confirmation. No minute-level ETA until an agent is assigned and out for delivery.
- **Food orders**: Ready during business operating hours. Timing depends on kitchen prep time and business schedule.
- **Rentals**: Pickup and drop-off at business location. Coordinate timing directly with the business for pickup/return.
- Fees are calculated by distance; checkout shows the delivery fee before payment.
- **Tracking**: Track delivery progress on web or in the app once an agent is assigned. Live location and ETA are available when the order is out for delivery.
- Delivery is available in supported markets (Gabon, Cameroon, Canada) where delivery_enabled is on for the location.
- For payment at delivery: supported for mobile-money markets when the merchant allows it; not available for Stripe-rail sellers. The courier sends a mobile payment request when they arrive; the customer approves it on their phone.`;

const FR = `Comment fonctionne la livraison sur Rendasua :

- Les commandes peuvent être livrées (agent/coursier) ou retirées en magasin.
- **Produits de magasin** : Habituellement 24–48 h après confirmation de commande. Pas d'ETA en minutes avant qu'un agent soit assigné et en livraison.
- **Commandes alimentaires** : Prêtes pendant les heures d'ouverture. Le délai dépend du temps de préparation et de l'horaire du commerce.
- **Locations** : Retrait et retour au lieu du commerce. Coordonnez l'horaire directement avec le commerce pour le retrait/retour.
- Les frais sont calculés selon la distance ; le checkout les affiche avant paiement.
- **Suivi** : Suivez la livraison sur le web ou dans l'app une fois un agent assigné. Position en direct et ETA disponibles lorsque la commande est en livraison.
- La livraison est disponible dans les marchés supportés (Gabon, Cameroun, Canada) lorsque la livraison est activée pour le lieu.
- Paiement à la livraison : disponible sur les marchés mobile money lorsque le commerçant l'autorise ; non disponible pour les vendeurs sur le rail Stripe. Le livreur envoie une demande de paiement mobile à son arrivée ; le client l'approuve sur son téléphone.`;

export function getDeliveryKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
