export interface AboutUsOfficeEntry {
  readonly id: string;
  readonly isHeadOffice?: boolean;
  readonly nameDefault: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
}

export const ABOUT_US_OFFICE_ENTRIES: readonly AboutUsOfficeEntry[] = [
  {
    id: 'canadaMontreal',
    isHeadOffice: true,
    nameDefault: 'B&T Canada, Montréal (QC) — Head office',
    address: '3 Place Ville Marie, Montreal, Quebec, H3B 2E3',
    phone: '+1 (855) 648 8855',
    email: 'management@groupe-bt.com',
  },
  {
    id: 'douala',
    nameDefault: 'B&T Douala — Cameroon',
    address: "Galeries B'ssadi, Douala, Littoral, 00237",
    phone: '+237 6 58 53 91 10',
    email: 'management.cmr@groupe-bt.com',
  },
  {
    id: 'yaounde',
    nameDefault: 'B&T Yaoundé',
    address:
      'Face Caisse des Dépôts et Consignations, 2e étage, Bastos, Yaoundé, 00237',
    phone: '+237 6 95 19 69 55',
    email: 'management.yde@groupe-bt.com',
  },
  {
    id: 'congo',
    nameDefault: 'B&T Congo (HQ)',
    address: 'Immeuble Moka, Grand Marché, Pointe-Noire, PN, 00242',
    phone: '+242 06 789 4453',
    email: 'management.rc@groupe-bt.com',
  },
  {
    id: 'togo',
    nameDefault: 'B&T Togo',
    address: 'Immeuble Ioka, Lomé, Lomé, 00228',
    phone: '+228 97 06 46 24',
    email: 'management.togo@groupe-bt.com',
  },
  {
    id: 'gabon',
    nameDefault: 'B&T Gabon',
    address: "1295, boul. de l'Indépendance, Libreville, 00241",
    phone: '+241 04 08 87 97',
    email: 'management.gabon@groupe-bt.com',
  },
  {
    id: 'canadaSudbury',
    nameDefault: 'B&T Canada — Sudbury (ON)',
    address: '195-159 Louis Street, Sudbury, Ontario, P3B 2H4',
    phone: '+1 579 636 2022',
    email: 'management@groupe-bt.com',
  },
  {
    id: 'coteIvoire',
    nameDefault: "B&T Côte d'Ivoire",
    address:
      'Marcoty Remblais, Lot 45 IIot 8, Section ST, Parcelle 550, Abidjan, 00225',
    phone: '+225 05 00 75 3737',
    email: 'management.ci@groupe-bt.com',
  },
  {
    id: 'applyProjectMontreal',
    nameDefault: 'ApplyProject Canada',
    address: '3 Pl. Ville Marie, suite 400, Montréal (QC), H3B 2E3',
    phone: '+1 (514) 427 0221',
    email: 'invest@applyproject.com',
  },
];
