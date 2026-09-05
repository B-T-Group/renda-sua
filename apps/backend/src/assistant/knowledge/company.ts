import type { KnowledgeLocale } from './types';

const EN = `Rendasua is a Groupe BT marketplace founded in Gabon in 2023. We connect buyers with local merchants for sales and rentals, with delivery and in-store pickup.

Office locations (Groupe BT / Rendasua presence):
- Montréal, QC (head office): 3 Place Ville Marie, Montreal, Quebec, H3B 2E3 — +1 (855) 648 8855 — management@groupe-bt.com
- Sudbury, ON: 195-159 Louis Street, Sudbury, Ontario, P3B 2H4 — +1 579 636 2022
- Douala, Cameroon: Galeries B'ssadi — +237 6 58 53 91 10
- Yaoundé, Cameroon: Bastos — +237 6 95 19 69 55
- Libreville, Gabon: 1295, boul. de l'Indépendance — +241 04 08 87 97
- Pointe-Noire, Congo: Immeuble Moka, Grand Marché — +242 06 789 4453
- Lomé, Togo: Immeuble Ioka — +228 97 06 46 24
- Abidjan, Côte d'Ivoire: Marcoty Remblais — +225 05 00 75 3737

General contact: contact@rendasua.com`;

const FR = `Rendasua est une place de marché du Groupe BT, fondée au Gabon en 2023. Nous connectons les acheteurs aux commerçants locaux pour la vente et la location, avec livraison et retrait en magasin.

Bureaux (présence Groupe BT / Rendasua) :
- Montréal, QC (siège) : 3 Place Ville Marie, Montréal (Québec) H3B 2E3 — +1 (855) 648 8855 — management@groupe-bt.com
- Sudbury, ON : 195-159 Louis Street, Sudbury (Ontario) P3B 2H4 — +1 579 636 2022
- Douala, Cameroun : Galeries B'ssadi — +237 6 58 53 91 10
- Yaoundé, Cameroun : Bastos — +237 6 95 19 69 55
- Libreville, Gabon : 1295, boul. de l'Indépendance — +241 04 08 87 97
- Pointe-Noire, Congo : Immeuble Moka, Grand Marché — +242 06 789 4453
- Lomé, Togo : Immeuble Ioka — +228 97 06 46 24
- Abidjan, Côte d'Ivoire : Marcoty Remblais — +225 05 00 75 3737

Contact général : contact@rendasua.com`;

export function getCompanyKnowledge(locale: KnowledgeLocale): string {
  return locale === 'fr' ? FR : EN;
}
