import type { KnowledgeLocale } from './types';

const EN = `In-store pickup on Rendasua:

- Yes, we support in-store pickup when the merchant offers it.
- At checkout (or by switching fulfillment), customers can choose pickup instead of delivery.
- Pay-at-pickup is supported for mobile money: the customer can pay when collecting the order (merchant push / MoMo flow).
- The order shows pickup instructions and timing in the app.
- Pickup is not available for every listing; availability depends on the business location.`;

const FR = `Retrait en magasin sur Rendasua :

- Oui, nous proposons le retrait en magasin lorsque le commerçant l'offre.
- Au checkout (ou en changeant le mode de fulfillment), le client peut choisir le retrait plutôt que la livraison.
- Le paiement au retrait est supporté pour le mobile money : le client peut payer lors de la collecte (push commerçant / flux MoMo).
- La commande affiche les instructions et horaires de retrait dans l'application.
- Le retrait n'est pas disponible pour tous les articles ; cela dépend de l'emplacement du commerce.`;

export function getPickupKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
