import type { KnowledgeLocale } from './types';

const EN = `In-store pickup on Rendasua:

- Yes, we support in-store pickup when the merchant offers it.
- At checkout (or by switching fulfillment), customers can choose pickup instead of delivery.
- Pay-at-pickup is for mobile money (not Stripe cards): when the order is ready, go to the store, tap Pay in the app, and approve the mobile money request on your phone. After approval the order is complete and you can collect your items. The merchant can also send a payment request if you need help.
- Prepaid pickup (card or pay-now) uses a pickup PIN instead of a payment request.
- The order shows pickup instructions and timing in the app.
- Pickup is not available for every listing; availability depends on the business location.`;

const FR = `Retrait en magasin sur Rendasua :

- Oui, nous proposons le retrait en magasin lorsque le commerçant l'offre.
- Au checkout (ou en changeant le mode de fulfillment), le client peut choisir le retrait plutôt que la livraison.
- Le paiement au retrait concerne le mobile money (pas Stripe) : lorsque la commande est prête, rendez-vous au magasin, appuyez sur Payer dans l'application et approuvez la demande de paiement mobile sur votre téléphone. Une fois approuvée, la commande est finalisée et vous pouvez récupérer vos articles. Le commerçant peut aussi envoyer une demande si vous avez besoin d'aide.
- Un retrait déjà payé (carte ou paiement immédiat) utilise un code PIN de retrait, pas une demande de paiement.
- La commande affiche les instructions et horaires de retrait dans l'application.
- Le retrait n'est pas disponible pour tous les articles ; cela dépend de l'emplacement du commerce.`;

export function getPickupKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
