import type { KnowledgeLocale } from './types';

function countrySection(country: string | null | undefined, locale: KnowledgeLocale): string {
  const code = (country || '').toUpperCase();
  if (locale === 'fr') {
    if (code === 'CM') {
      return `Pour le Cameroun : MTN Mobile Money et Orange Money. Paiement maintenant, à la livraison (pay_at_delivery) ou au retrait (pay_at_pickup) selon le commerçant. Pour payer à la livraison ou au retrait en mobile money, un acompte n'est prélevé que pour les articles dont le commerçant l'a activé, au pourcentage qu'il a fixé sur le prix de l'article (1 à 25 %). Si la somme en XAF est inférieure à 150, l'acompte est de 150 XAF, sans dépasser le total. Le reste est demandé à la porte ou en magasin.`;
    }
    if (code === 'GA') {
      return `Pour le Gabon : Airtel Money et Moov. Paiement maintenant, à la livraison ou au retrait selon le commerçant. Pour payer à la livraison ou au retrait en mobile money, un acompte n'est prélevé que pour les articles dont le commerçant l'a activé, au pourcentage qu'il a fixé sur le prix de l'article (1 à 25 %). Si la somme en XAF est inférieure à 150, l'acompte est de 150 XAF, sans dépasser le total. Le reste est demandé à la porte ou en magasin.`;
    }
    if (code === 'CA' || code === 'US' || code === 'PH') {
      const label =
        code === 'CA' ? 'le Canada' : code === 'PH' ? 'les Philippines' : "les États-Unis";
      return `Pour ${label} : cartes bancaires via Stripe. Le paiement à la livraison n'est pas disponible pour les vendeurs sur le rail Stripe.`;
    }
    return `Rails de paiement : Afrique centrale/ouest (GA/CM) = mobile money ; CA/US/PH = Stripe (cartes). Le paiement à la livraison n'est pas disponible pour les vendeurs Stripe.`;
  }
  if (code === 'CM') {
    return `For Cameroon: MTN Mobile Money and Orange Money. Customers can pay now, at delivery (pay_at_delivery), or at pickup (pay_at_pickup) depending on the merchant. For mobile-money pay-at-delivery or pay-at-pickup, a deposit is collected only for items the merchant opted in, at that item's percent of its price (1 to 25). If the XAF sum is under 150, the deposit is 150 XAF, never more than the order total. The remainder is requested at the door or in store.`;
  }
  if (code === 'GA') {
    return `For Gabon: Airtel Money and Moov. Customers can pay now, at delivery, or at pickup depending on the merchant. For mobile-money pay-at-delivery or pay-at-pickup, a deposit is collected only for items the merchant opted in, at that item's percent of its price (1 to 25). If the XAF sum is under 150, the deposit is 150 XAF, never more than the order total. The remainder is requested at the door or in store.`;
  }
  if (code === 'CA' || code === 'US' || code === 'PH') {
    const label =
      code === 'CA' ? 'Canada' : code === 'PH' ? 'the Philippines' : 'the United States';
    return `For ${label}: card payments via Stripe. Pay-at-delivery is not available for Stripe-rail sellers.`;
  }
  return `Payment rails: Central/West Africa (GA/CM) use mobile money; CA/US/PH use Stripe cards. Pay-at-delivery is blocked for Stripe-rail sellers.`;
}

export function getPaymentsKnowledge(
  locale: KnowledgeLocale,
  country?: string | null
): string {
  const base =
    locale === 'fr'
      ? `Rendasua prend en charge le mobile money en Afrique et les cartes (Stripe) au Canada, aux États-Unis et aux Philippines.

- Cameroun : MTN Mobile Money, Orange Money
- Gabon : Airtel Money, Moov
- Canada / États-Unis / Philippines : cartes via Stripe

Options de moment de paiement : payer maintenant, payer à la livraison, ou payer au retrait en magasin (selon le commerçant et le rail). Le paiement à la livraison n'est pas disponible lorsque le vendeur utilise Stripe.

Acompte de réservation (mobile money, payer à la livraison ou au retrait) : uniquement pour les articles dont le commerçant a activé l'acompte, au pourcentage de 1 à 25 % du prix de l'article. La livraison, l'expédition et les taxes ne comptent pas. Si la somme en XAF est supérieure à 0 mais inférieure à 150, l'acompte est de 150 XAF, sans dépasser le total de la commande. S'il n'y a aucun article activé, aucun acompte. L'acompte est bloqué sur le portefeuille Rendasua du client (il ne peut pas le retirer). Le reste est demandé à la porte ou en magasin. Si la commande est annulée avant le point de verrouillage (en livraison : « en cours de livraison » ; au retrait : « prêt au retrait »), l'acompte est libéré vers le solde disponible du portefeuille client. Après ce point, une annulation client entraîne la confiscation de l'acompte au profit de Rendasua. Pour une commande à payer au retrait qui n'est pas encore payée, si le client ne vient pas la chercher, le magasin peut l'annuler pour absence une fois le délai de retrait écoulé après « prêt au retrait » (au moins 1 heure, 2 heures par défaut) : l'acompte est alors conservé par Rendasua et aucun autre frais n'est prélevé. Une annulation commerçant ou plateforme pour une autre raison rembourse l'acompte même après le verrouillage. Une fois la commande payée, l'acompte est déduit du prix et ne peut plus être confisqué.

Pour le paiement à la livraison, le livreur envoie une demande de paiement mobile à la porte ; le client l'approuve sur son téléphone (il n'appuie pas sur Payer dans l'application). Pour un retrait en mobile money, le client appuie sur Payer dans l'application à son arrivée et approuve la demande sur son téléphone ; une fois payée, la commande est finalisée et il peut récupérer ses articles. Le commerçant peut aussi envoyer une demande s'il a besoin d'aide. La demande Mobile Money est envoyée au numéro Mobile Money enregistré du client, ou à son numéro de profil s'il n'en a pas encore défini un.

Plats cuisinés (livraison ou retrait ASAP) : pas d'acompte de réservation en mobile money — le commerçant confirme avec un délai de préparation, puis le montant total est prélevé après confirmation (portefeuille Rendasua si le solde suffit, sinon mobile money). Après paiement client, la cuisine prépare ; une fois prêt, le client finalise le retrait dans l'application (sans PIN) et la livraison attend un livreur. Si le client annule après avoir payé, un pourcentage du pays sur les articles est conservé et le reste est remboursé. La moitié de ces frais va au magasin et l'autre moitié à Rendasua. Annuler avant le paiement est gratuit. Pour un retrait en magasin déjà payé, le magasin peut rappeler au client de venir chercher. Après 2 heures prêt (ce délai peut varier selon le pays), le magasin peut annuler si le client n'est pas venu ; les mêmes frais s'appliquent. Une fois un livreur assigné, utiliser plutôt l'échec de livraison.

Un petit frais de service forfaitaire est inclus dans le total : 100 XAF au Cameroun, au Gabon et au Congo, et 0,99 CAD au Canada. Les autres pays n'ont pas de frais tant qu'aucun montant n'est configuré. Ce ne sont pas des frais de livraison. Les codes de réduction, les crédits boutique et l'acompte ne le réduisent pas. Le paiement à la livraison ou au retrait le perçoit avec le solde. La carte est débitée dans la devise du vendeur.

Frais d'annulation client : un pourcentage du prix des articles après réductions (livraison, taxes et frais de service exclus). Cameroun et Gabon 30 pour cent, Canada 0. La moitié va au magasin et la moitié à Rendasua. Ils s'appliquent quand le client annule après confirmation du magasin et, pour le paiement après confirmation, seulement une fois le client a payé.`
      : `Rendasua supports mobile money in Africa and card payments (Stripe) in Canada, the United States, and the Philippines.

- Cameroon: MTN Mobile Money, Orange Money
- Gabon: Airtel Money, Moov
- Canada / United States / Philippines: cards via Stripe

Payment timing options: pay now, pay at delivery, or pay at in-store pickup (depending on the merchant and payment rail). Pay-at-delivery is not available when the seller uses the Stripe rail.

Reservation deposit (mobile money pay-at-delivery or pay-at-pickup): only for items the merchant opted in, at that item's percent of its price (1 to 25). Delivery, shipping, and tax are not included. If the XAF sum is greater than 0 but under 150, the deposit is 150 XAF, never more than the order total. If no item is opted in, there is no deposit. The deposit is held on the client's Rendasua wallet (it cannot be withdrawn). The remainder is requested at the door or in store. If the order is cancelled before the lock point (delivery: out for delivery; pickup: ready for pickup), the deposit is released to the client's available wallet balance. After the lock point, a customer cancel forfeits the deposit to Rendasua. For a pay-at-pickup order that is not paid yet, if the customer does not come, the store can cancel it as a no-show once the pickup window after ready for pickup has passed (at least 1 hour, 2 hours by default); the deposit is then kept by Rendasua and no other fee is charged. A business or platform cancel for any other reason still refunds the deposit even after the lock point. Once the order is paid, the deposit counts toward the price and can no longer be forfeited.

For pay-at-delivery, the courier sends a mobile payment request at the door; the customer approves it on their phone (they do not tap Pay in the app). For mobile-money pickup, the customer taps Pay in the app when they arrive and approves the request on their phone; after approval the order is complete and they can collect it. The merchant can also send a payment request if they need help. The Mobile Money prompt goes to the customer's saved Mobile Money number, or their profile phone if they have not set one.

Cooked-food ASAP delivery or pickup (restaurant dishes): there is no reservation deposit on mobile money — the merchant confirms with a ready-in time, then the full amount is charged after confirm (from the Rendasua wallet if balance covers it, otherwise mobile money). After the client pays, the kitchen prepares; when ready, pickup clients Complete in the app (no PIN) and delivery waits for a courier. If the client cancels after paying, a country percentage of the items is kept and the rest is refunded. Half of that fee goes to the store and half stays with Rendasua. Cancelling before payment is free. For a paid in-store pickup, the store can remind the client to collect. After the order has been ready for 2 hours (this wait can differ by country), the store can cancel because the client did not pick up; the same fee applies. Once a courier is assigned, use failed delivery instead.

A small flat service fee is included in the order total: 100 XAF in Cameroon, Gabon, and Congo, and 0.99 CAD in Canada. Other countries have no fee until one is configured. It is not a delivery fee. Discount codes, store credits, and the reservation deposit do not reduce it. Pay-at-delivery and pay-at-pickup collect it with the balance. The card is charged in the seller's currency.

Client cancellation fee: a percentage of the item price after discounts (delivery, tax, and the service fee are not included). Cameroon and Gabon 30 percent, Canada 0. Half of the fee is paid to the store and half to Rendasua. It applies when the client cancels after the store has confirmed and, for pay-after-confirm, only after the client has paid.`;

  const credits =
    locale === 'fr'
      ? `Crédits boutique (crédits d'achat) : ce ne sont pas de l'argent portefeuille — ils ne sont pas retirables. Ils s'appliquent automatiquement au sous-total des articles à la caisse (pas aux frais de livraison, au frais de service, ni aux acomptes). Selon la campagne, un crédit peut servir dans toute boutique, chez les partenaires Rendasua, ou chez un partenaire précis. Consultez vos crédits dans le menu Portefeuille.`
      : `Store credits (purchase credits): these are not wallet cash — they cannot be withdrawn. They apply automatically to item subtotals at checkout (not delivery fees, the service fee, or deposits). Depending on the campaign, a credit may work at any store, at Rendasua partner stores, or at one specific partner. Check your credits under the Wallet menu.`;

  return `${base}\n\n${countrySection(country, locale)}\n\n${credits}`;
}
