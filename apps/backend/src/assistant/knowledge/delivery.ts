import type { KnowledgeLocale } from './types';

const EN = `How delivery works on Rendasua:

- Orders can be fulfilled by delivery (agent/courier) or in-store pickup.
- **Store products**: Usually 24–48 hours from order confirmation. No minute-level ETA until an agent is assigned and out for delivery.
- **Food orders**: ASAP only while a dish is being served. Serving days and hours override the business location hours. Timing depends on prep time; future-slot scheduling is not available for cooked food.
- **Rentals**: Pickup and drop-off at business location. Coordinate timing directly with the business for pickup/return.
- Delivery is offered only when an active agent is within 5 km of the store. Agents are notified only inside that distance. If no agent is that close, only pickup is offered.
- Fees are calculated by distance and shown at checkout. In Cameroon and Gabon the fee is at most 1000 XAF: a 500 XAF base plus 100 XAF per km, which covers customers within 5 km. Inside those 5 km the fee is waived when the order commission is at least 10000 XAF. Beyond 5 km, only pickup is offered.
- **Tracking**: Track delivery progress on web or in the app once an agent is assigned. Live location and ETA are available when the order is out for delivery.
- Delivery is available in supported markets (Gabon, Cameroon, Canada, Philippines) where delivery_enabled is on for the location.
- For payment at delivery: supported for mobile-money markets when the merchant allows it; not available for Stripe-rail sellers. The courier sends a mobile payment request when they arrive; the customer approves it on their phone.`;

const FR = `Comment fonctionne la livraison sur Rendasua :

- Les commandes peuvent être livrées (agent/coursier) ou retirées en magasin.
- **Produits de magasin** : Habituellement 24–48 h après confirmation de commande. Pas d'ETA en minutes avant qu'un agent soit assigné et en livraison.
- **Commandes alimentaires** : ASAP uniquement pendant les horaires de service du plat. Ces jours et heures priment sur les horaires du lieu. Le délai dépend du temps de préparation ; la planification d'un créneau futur n'est pas disponible pour les plats cuisinés.
- **Locations** : Retrait et retour au lieu du commerce. Coordonnez l'horaire directement avec le commerce pour le retrait/retour.
- La livraison n'est proposée que lorsqu'un livreur actif se trouve à moins de 5 km du magasin. Les livreurs ne sont notifiés qu'à l'intérieur de cette distance. S'il n'y a pas de livreur aussi proche, seul le retrait est proposé.
- Les frais dépendent de la distance et sont affichés au paiement. Au Cameroun et au Gabon, les frais sont d'au plus 1000 XAF : un forfait de 500 XAF plus 100 XAF par km, ce qui couvre les clients à moins de 5 km. Dans ces 5 km, les frais sont offerts lorsque la commission de la commande est d'au moins 10000 XAF. Au-delà de 5 km, seul le retrait est proposé.
- **Suivi** : Suivez la livraison sur le web ou dans l'app une fois un agent assigné. Position en direct et ETA disponibles lorsque la commande est en livraison.
- La livraison est disponible dans les marchés supportés (Gabon, Cameroun, Canada, Philippines) lorsque la livraison est activée pour le lieu.
- Paiement à la livraison : disponible sur les marchés mobile money lorsque le commerçant l'autorise ; non disponible pour les vendeurs sur le rail Stripe. Le livreur envoie une demande de paiement mobile à son arrivée ; le client l'approuve sur son téléphone.`;

export function getDeliveryKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
