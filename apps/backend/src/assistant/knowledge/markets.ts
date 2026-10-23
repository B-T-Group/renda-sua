import type { KnowledgeLocale } from './types';

const EN = `Markets we currently serve for shopping, delivery, and checkout:

- Gabon (GA) — mobile money marketplace (Airtel Money, Moov)
- Cameroon (CM) — mobile money marketplace (MTN Mobile Money, Orange Money)
- Canada (CA) — card payments via Stripe
- Philippines (PH) — card payments via Stripe

The United States (US) is enabled for Stripe card payments. Groupe BT also has a presence in Congo, Togo, and Côte d'Ivoire; these are not currently listed as live Rendasua markets.

Some goods listed from Canada are available for export into Cameroon, Gabon, the Philippines, and the Democratic Republic of the Congo (RDC, CD). Shoppers in those markets see an “Available for export” section and can submit interest (not local checkout); the seller follows up outside the app.

The Democratic Republic of the Congo (RDC, CD) is open for that export interest only. Local shopping, delivery, pickup, and local payment are not available there yet. RDC is not the Republic of the Congo (Congo-Brazzaville, CG).

Only the shopping markets listed above are live for delivery and checkout. RDC is export interest only. Any other country (for example Brazil) is not currently served by Rendasua — do not invent coverage, local payment rails, or launch status.
When unsure about a country, say we will confirm availability and get back shortly rather than inventing coverage.`;

const FR = `Marchés actuellement desservis pour l'achat, la livraison et le paiement :

- Gabon (GA) — mobile money (Airtel Money, Moov)
- Cameroun (CM) — mobile money (MTN Mobile Money, Orange Money)
- Canada (CA) — cartes via Stripe
- Philippines (PH) — cartes via Stripe

Les États-Unis (US) sont activés pour les paiements par carte Stripe. Le Groupe BT est aussi présent au Congo, au Togo et en Côte d'Ivoire ; ces pays ne figurent pas actuellement parmi les marchés Rendasua actifs.

Certains produits listés depuis le Canada sont disponibles à l'export vers le Cameroun, le Gabon, les Philippines et la République démocratique du Congo (RDC, CD). Les acheteurs de ces marchés voient une section « Disponible à l'export » et peuvent manifester leur intérêt (pas de paiement local) ; le vendeur assure le suivi hors application.

La République démocratique du Congo (RDC, CD) est ouverte uniquement pour cet intérêt à l'export. L'achat local, la livraison, le retrait et le paiement local n'y sont pas encore disponibles. La RDC n'est pas la République du Congo (Congo-Brazzaville, CG).

Seuls les marchés d'achat listés ci-dessus sont actifs pour la livraison et le paiement. La RDC est limitée à l'intérêt à l'export. Tout autre pays (par exemple le Brésil) n'est pas actuellement desservi par Rendasua — n'inventez ni couverture, ni moyens de paiement locaux, ni statut de lancement.
En cas de doute sur un pays, indiquez que nous confirmerons la disponibilité et reviendrons sous peu, sans inventer de couverture.`;

export function getMarketsKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
