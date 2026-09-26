import type { KnowledgeLocale } from './types';

const EN = `In-store pickup on Rendasua:

- Yes, we support in-store pickup when the merchant offers it.
- At checkout (or by switching fulfillment), customers can choose pickup instead of delivery.
- Pay-at-pickup is for mobile money (not Stripe cards): when the order is ready, go to the store, tap Pay in the app, and approve the mobile money request on your phone. After approval the order is complete and you can collect your items. The merchant can also send a payment request if you need help.
- Prepaid pickup (card or pay-now) uses a pickup PIN instead of a payment request.
- The order shows pickup instructions and timing in the app.
- Cooked-food pickup is ASAP only (no future pickup slot). Place the order when the kitchen is open.
- Cooked-food pay-after flow: merchant confirms → you pay → kitchen prepares → ready. Complete pickup in the app when ready (primary). Cancelling at ready keeps a cancellation fee and refunds the rest. Merchants may mark failed pickup (no-show) with the same fee rule.
- Pickup is not available for every listing; availability depends on the business location.`;

const FR = `Retrait en magasin sur Rendasua :

- Oui, nous proposons le retrait en magasin lorsque le commerçant l'offre.
- Au checkout (ou en changeant le mode de fulfillment), le client peut choisir le retrait plutôt que la livraison.
- Le paiement au retrait concerne le mobile money (pas Stripe) : lorsque la commande est prête, rendez-vous au magasin, appuyez sur Payer dans l'application et approuvez la demande de paiement mobile sur votre téléphone. Une fois approuvée, la commande est finalisée et vous pouvez récupérer vos articles. Le commerçant peut aussi envoyer une demande si vous avez besoin d'aide.
- Un retrait déjà payé (carte ou paiement immédiat) utilise un code PIN de retrait, pas une demande de paiement.
- La commande affiche les instructions et horaires de retrait dans l'application.
- Le retrait de plats cuisinés est ASAP uniquement (pas de créneau futur). Passez commande lorsque la cuisine est ouverte.
- Flux plats cuisinés (paiement après confirmation) : le commerçant confirme → vous payez → préparation → prêt. Finalisez le retrait dans l'application (action principale). Une annulation une fois prêt conserve des frais d'annulation et rembourse le reste. Le commerçant peut marquer un échec de retrait (absence) avec la même règle de frais.
- Le retrait n'est pas disponible pour tous les articles ; cela dépend de l'emplacement du commerce.`;

export function getPickupKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
