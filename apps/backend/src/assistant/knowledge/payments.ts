import type { KnowledgeLocale } from './types';

function countrySection(country: string | null | undefined, locale: KnowledgeLocale): string {
  const code = (country || '').toUpperCase();
  if (locale === 'fr') {
    if (code === 'CM') {
      return `Pour le Cameroun : MTN Mobile Money et Orange Money. Paiement maintenant, à la livraison (pay_at_delivery) ou au retrait (pay_at_pickup) selon le commerçant.`;
    }
    if (code === 'GA') {
      return `Pour le Gabon : Airtel Money et Moov. Paiement maintenant, à la livraison ou au retrait selon le commerçant.`;
    }
    if (code === 'CA' || code === 'US') {
      return `Pour ${code === 'CA' ? 'le Canada' : "les États-Unis"} : cartes bancaires via Stripe. Le paiement à la livraison n'est pas disponible pour les vendeurs sur le rail Stripe.`;
    }
    return `Rails de paiement : Afrique centrale/ouest (GA/CM) = mobile money ; CA/US = Stripe (cartes). Le paiement à la livraison n'est pas disponible pour les vendeurs Stripe.`;
  }
  if (code === 'CM') {
    return `For Cameroon: MTN Mobile Money and Orange Money. Customers can pay now, at delivery (pay_at_delivery), or at pickup (pay_at_pickup) depending on the merchant.`;
  }
  if (code === 'GA') {
    return `For Gabon: Airtel Money and Moov. Customers can pay now, at delivery, or at pickup depending on the merchant.`;
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

Options de moment de paiement : payer maintenant, payer à la livraison, ou payer au retrait en magasin (selon le commerçant et le rail). Le paiement à la livraison n'est pas disponible lorsque le vendeur utilise Stripe. Pour le paiement à la livraison, le livreur envoie une demande de paiement mobile à la porte ; le client l'approuve sur son téléphone (il n'appuie pas sur Payer dans l'application). Pour un retrait en mobile money, le client appuie sur Payer dans l'application à son arrivée et approuve la demande sur son téléphone ; une fois payée, la commande est finalisée et il peut récupérer ses articles. Le commerçant peut aussi envoyer une demande s'il a besoin d'aide.`
      : `Rendasua supports mobile money in Africa and card payments (Stripe) in Canada and the United States.

- Cameroon: MTN Mobile Money, Orange Money
- Gabon: Airtel Money, Moov
- Canada / United States: cards via Stripe

Payment timing options: pay now, pay at delivery, or pay at in-store pickup (depending on the merchant and payment rail). Pay-at-delivery is not available when the seller uses the Stripe rail. For pay-at-delivery, the courier sends a mobile payment request at the door; the customer approves it on their phone (they do not tap Pay in the app). For mobile-money pickup, the customer taps Pay in the app when they arrive and approves the request on their phone; after approval the order is complete and they can collect it. The merchant can also send a payment request if they need help.`;

  return `${base}\n\n${countrySection(country, locale)}`;
}
