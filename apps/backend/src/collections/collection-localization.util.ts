export type CollectionLang = 'en' | 'fr';

export function resolveCollectionLang(
  lang?: string,
  acceptLanguage?: string
): CollectionLang {
  const normalized = lang?.trim().toLowerCase();
  if (normalized === 'fr' || normalized === 'en') {
    return normalized;
  }
  if (acceptLanguage?.toLowerCase().includes('fr')) {
    return 'fr';
  }
  return 'en';
}

export function localizeCollectionRow(
  row: {
    name_en: string;
    name_fr: string;
    description_en?: string | null;
    description_fr?: string | null;
  },
  lang: CollectionLang
): { name: string; description: string | null } {
  return {
    name: lang === 'fr' ? row.name_fr : row.name_en,
    description:
      lang === 'fr'
        ? row.description_fr ?? null
        : row.description_en ?? null,
  };
}
