import type { KnowledgeLocale } from './types';

const EN = `Markets we currently serve for shopping, delivery, and checkout:

- Gabon (GA) — mobile money marketplace (Airtel Money, Moov)
- Cameroon (CM) — mobile money marketplace (MTN Mobile Money, Orange Money)
- Canada (CA) — card payments via Stripe
- Philippines (PH) — card payments via Stripe

The United States (US) is enabled for Stripe card payments. Groupe BT also has a presence in Congo, Togo, and Côte d'Ivoire; these are not currently listed as full shopping markets with local delivery and checkout in every case.

Some goods listed from Canada are available for export into Cameroon, Côte d'Ivoire (CI), Togo, Congo-Brazzaville (CG), Gabon, the Philippines, and the Democratic Republic of the Congo (RDC, CD). Shoppers in those markets see an “Available for export” section and can submit interest (not local cart checkout).

When the export-orders workflow flag is on, “I’m interested” opens a B2B export order (bon de commande → Canada admin review → proforma → invoice → deposit by wire in CAD). When the flag is off, interest remains a lead for the seller to follow up outside the app.

The Democratic Republic of the Congo (RDC, CD) is open for that export interest only. Local shopping, delivery, pickup, and local payment are not available there yet. RDC is not the Republic of the Congo (Congo-Brazzaville, CG).

Only the shopping markets listed above are live for delivery and checkout. RDC is export interest only. Any other country (for example Brazil) is not currently served by Rendasua — do not invent coverage, local payment rails, or launch status.
When unsure about a country, say we will confirm availability and get back shortly rather than inventing coverage.`;

const FR = `Marchés actuellement desservis pour l'achat, la livraison et le paiement :

- Gabon (GA) — mobile money (Airtel Money, Moov)
- Cameroun (CM) — mobile money (MTN Mobile Money, Orange Money)
- Canada (CA) — cartes via Stripe
- Philippines (PH) — cartes via Stripe

Les États-Unis (US) sont activés pour les paiements par carte Stripe. Le Groupe BT est aussi présent au Congo, au Togo et en Côte d'Ivoire ; ces pays ne figurent pas toujours parmi les marchés d'achat complets avec livraison et paiement local.

Certains produits listés depuis le Canada sont disponibles à l'export vers le Cameroun, la Côte d'Ivoire (CI), le Togo, le Congo-Brazzaville (CG), le Gabon, les Philippines et la République démocratique du Congo (RDC, CD). Les acheteurs de ces marchés voient une section « Disponible à l'export » et peuvent manifester leur intérêt (pas de panier local).

Lorsque le flux commandes export est activé, « Je suis intéressé » crée une commande B2B (bon de commande → analyse Canada → proforma → facture → dépôt par virement en CAD). Sinon, l'intérêt reste une piste suivie hors application par le vendeur.

La République démocratique du Congo (RDC, CD) est ouverte uniquement pour cet intérêt à l'export. L'achat local, la livraison, le retrait et le paiement local n'y sont pas encore disponibles. La RDC n'est pas la République du Congo (Congo-Brazzaville, CG).

Seuls les marchés d'achat listés ci-dessus sont actifs pour la livraison et le paiement. La RDC est limitée à l'intérêt à l'export. Tout autre pays (par exemple le Brésil) n'est pas actuellement desservi par Rendasua — n'inventez ni couverture, ni moyens de paiement locaux, ni statut de lancement.
En cas de doute sur un pays, indiquez que nous confirmerons la disponibilité et reviendrons sous peu, sans inventer de couverture.`;

export function getMarketsKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
