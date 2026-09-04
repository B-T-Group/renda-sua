import type { KnowledgeLocale } from './types';

const EN = `Markets we currently serve for shopping, delivery, and checkout:

- Gabon (GA) — mobile money marketplace (Airtel Money, Moov)
- Cameroon (CM) — mobile money marketplace (MTN Mobile Money, Orange Money)
- Canada (CA) — card payments via Stripe

The United States (US) is enabled for Stripe card payments. Groupe BT also has a presence in Congo, Togo, and Côte d'Ivoire; these are not currently listed as live Rendasua markets.

When unsure about a country, say we will confirm availability and get back shortly rather than inventing coverage.`;

const FR = `Marchés actuellement desservis pour l'achat, la livraison et le paiement :

- Gabon (GA) — mobile money (Airtel Money, Moov)
- Cameroun (CM) — mobile money (MTN Mobile Money, Orange Money)
- Canada (CA) — cartes via Stripe

Les États-Unis (US) sont activés pour les paiements par carte Stripe. Le Groupe BT est aussi présent au Congo, au Togo et en Côte d'Ivoire ; ces pays ne figurent pas actuellement parmi les marchés Rendasua actifs.

En cas de doute sur un pays, indiquez que nous confirmerons la disponibilité et reviendrons sous peu, sans inventer de couverture.`;

export function getMarketsKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
