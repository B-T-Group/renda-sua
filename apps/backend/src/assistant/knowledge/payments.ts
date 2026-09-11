import type { KnowledgeLocale } from './types';

function countrySection(country: string | null | undefined, locale: KnowledgeLocale): string {
  const code = (country || '').toUpperCase();
  if (locale === 'fr') {
    if (code === 'CM') {
      return `Pour le Cameroun : MTN Mobile Money et Orange Money. Paiement maintenant, à la livraison (pay_at_delivery) ou au retrait (pay_at_pickup) selon le commerçant. Pour payer à la livraison ou au retrait en mobile money, un acompte de réservation est prélevé à la commande ; le reste est demandé à la porte ou en magasin.`;
    }
    if (code === 'GA') {
      return `Pour le Gabon : Airtel Money et Moov. Paiement maintenant, à la livraison ou au retrait selon le commerçant. Pour payer à la livraison ou au retrait en mobile money, un acompte de réservation est prélevé à la commande ; le reste est demandé à la porte ou en magasin.`;
    }
    if (code === 'CA' || code === 'US') {
      return `Pour ${code === 'CA' ? 'le Canada' : "les États-Unis"} : cartes bancaires via Stripe. Le paiement à la livraison n'est pas disponible pour les vendeurs sur le rail Stripe.`;
    }
    return `Rails de paiement : Afrique centrale/ouest (GA/CM) = mobile money ; CA/US = Stripe (cartes). Le paiement à la livraison n'est pas disponible pour les vendeurs Stripe.`;
  }
  if (code === 'CM') {
    return `For Cameroon: MTN Mobile Money and Orange Money. Customers can pay now, at delivery (pay_at_delivery), or at pickup (pay_at_pickup) depending on the merchant. For mobile-money pay-at-delivery or pay-at-pickup, a reservation deposit is collected when the order is placed; the remainder is requested at the door or in store.`;
  }
  if (code === 'GA') {
    return `For Gabon: Airtel Money and Moov. Customers can pay now, at delivery, or at pickup depending on the merchant. For mobile-money pay-at-delivery or pay-at-pickup, a reservation deposit is collected when the order is placed; the remainder is requested at the door or in store.`;
  }
  if (code === 'CA' || code === 'US') {
    return `For ${code === 'CA' ? 'Canada' : 'the United States'}: card payments via Stripe. Pay-at-delivery is not available for Stripe-rail sellers.`;
  }
  return `Payment rails: Central/West Africa (GA/CM) use mobile money; CA/US use Stripe cards. Pay-at-delivery is blocked for Stripe-rail sellers.`;
}

export function getPaymentsKnowledge(
  locale: KnowledgeLocale,
  country?: string | null
): string {
  const base =
    locale === 'fr'
      ? `Rendasua prend en charge le mobile money en Afrique et les cartes (Stripe) au Canada et aux États-Unis.

- Cameroun : MTN Mobile Money, Orange Money
- Gabon : Airtel Money, Moov
- Canada / États-Unis : cartes via Stripe

Options de moment de paiement : payer maintenant, payer à la livraison, ou payer au retrait en magasin (selon le commerçant et le rail). Le paiement à la livraison n'est pas disponible lorsque le vendeur utilise Stripe.

Acompte de réservation (mobile money, payer à la livraison ou au retrait) : un acompte est prélevé à la commande et bloqué sur le portefeuille Rendasua du client (il ne peut pas le retirer). Le reste est demandé à la porte ou en magasin. Si la commande est annulée avant le point de verrouillage (en livraison : « en cours de livraison » ; au retrait : « prêt au retrait »), l'acompte est libéré vers le solde disponible du portefeuille client. Après ce point, une annulation client entraîne la confiscation de l'acompte au profit de Rendasua. Une annulation commerçant ou plateforme rembourse l'acompte même après le verrouillage.

Pour le paiement à la livraison, le livreur envoie une demande de paiement mobile à la porte ; le client l'approuve sur son téléphone (il n'appuie pas sur Payer dans l'application). Pour un retrait en mobile money, le client appuie sur Payer dans l'application à son arrivée et approuve la demande sur son téléphone ; une fois payée, la commande est finalisée et il peut récupérer ses articles. Le commerçant peut aussi envoyer une demande s'il a besoin d'aide.`
      : `Rendasua supports mobile money in Africa and card payments (Stripe) in Canada and the United States.

- Cameroon: MTN Mobile Money, Orange Money
- Gabon: Airtel Money, Moov
- Canada / United States: cards via Stripe

Payment timing options: pay now, pay at delivery, or pay at in-store pickup (depending on the merchant and payment rail). Pay-at-delivery is not available when the seller uses the Stripe rail.

Reservation deposit (mobile money pay-at-delivery or pay-at-pickup): a deposit is collected when the order is placed and held on the client's Rendasua wallet (it cannot be withdrawn). The remainder is requested at the door or in store. If the order is cancelled before the lock point (delivery: out for delivery; pickup: ready for pickup), the deposit is released to the client's available wallet balance. After the lock point, a customer cancel forfeits the deposit to Rendasua. A business or platform cancel refunds the deposit even after the lock point.

For pay-at-delivery, the courier sends a mobile payment request at the door; the customer approves it on their phone (they do not tap Pay in the app). For mobile-money pickup, the customer taps Pay in the app when they arrive and approves the request on their phone; after approval the order is complete and they can collect it. The merchant can also send a payment request if they need help.`;

  return `${base}\n\n${countrySection(country, locale)}`;
}
