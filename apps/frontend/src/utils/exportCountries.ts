/**
 * Country names for the Exports "Into / From" views, with the French article so copy
 * reads "Vers le Canada", "Exports du Canada". Unknown codes fall back to Intl, then the code.
 */
type FrArticle = 'le' | 'la' | 'l’' | 'les';

const EXPORT_COUNTRIES: Record<string, { en: string; fr: string; frArticle: FrArticle }> = {
  BJ: { en: 'Benin', fr: 'Bénin', frArticle: 'le' },
  CA: { en: 'Canada', fr: 'Canada', frArticle: 'le' },
  CD: { en: 'DR Congo', fr: 'RD Congo', frArticle: 'la' },
  CF: { en: 'Central African Republic', fr: 'République centrafricaine', frArticle: 'la' },
  CG: { en: 'Congo', fr: 'Congo', frArticle: 'le' },
  CI: { en: 'Côte d’Ivoire', fr: 'Côte d’Ivoire', frArticle: 'la' },
  CM: { en: 'Cameroon', fr: 'Cameroun', frArticle: 'le' },
  FR: { en: 'France', fr: 'France', frArticle: 'la' },
  GA: { en: 'Gabon', fr: 'Gabon', frArticle: 'le' },
  GH: { en: 'Ghana', fr: 'Ghana', frArticle: 'le' },
  GQ: { en: 'Equatorial Guinea', fr: 'Guinée équatoriale', frArticle: 'la' },
  NG: { en: 'Nigeria', fr: 'Nigeria', frArticle: 'le' },
  PH: { en: 'Philippines', fr: 'Philippines', frArticle: 'les' },
  SN: { en: 'Senegal', fr: 'Sénégal', frArticle: 'le' },
  TD: { en: 'Chad', fr: 'Tchad', frArticle: 'le' },
  TG: { en: 'Togo', fr: 'Togo', frArticle: 'le' },
  US: { en: 'United States', fr: 'États-Unis', frArticle: 'les' },
};

function isFrench(language?: string | null): boolean {
  return (language ?? '').toLowerCase().startsWith('fr');
}

/** Two upper-case letters, or null. */
export function normalizeCountryCode(raw?: string | null): string | null {
  const code = raw?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

export function isKnownExportCountry(code?: string | null): boolean {
  const c = normalizeCountryCode(code);
  return Boolean(c && EXPORT_COUNTRIES[c]);
}

function intlRegionName(code: string, language: string): string | null {
  try {
    const Ctor = (Intl as unknown as {
      DisplayNames?: new (l: string[], o: { type: 'region' }) => { of(c: string): string | undefined };
    }).DisplayNames;
    if (!Ctor) return null;
    const name = new Ctor([language], { type: 'region' }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/** "Canada" / "Cameroun". */
export function exportCountryName(code: string, language?: string | null): string {
  const c = normalizeCountryCode(code) ?? code;
  const entry = EXPORT_COUNTRIES[c];
  const fr = isFrench(language);
  if (entry) return fr ? entry.fr : entry.en;
  return intlRegionName(c, fr ? 'fr' : 'en') ?? c;
}

/** "Canada" (EN) / "le Canada", "la Côte d’Ivoire", "les Philippines" (FR). */
export function exportCountryPlace(code: string, language?: string | null): string {
  const name = exportCountryName(code, language);
  if (!isFrench(language)) return name;
  const entry = EXPORT_COUNTRIES[normalizeCountryCode(code) ?? ''];
  if (!entry) return name;
  return entry.frArticle === 'l’' ? `l’${name}` : `${entry.frArticle} ${name}`;
}

/** "Canada" (EN) / "du Canada", "de la Côte d’Ivoire", "des Philippines" (FR). */
export function exportCountryOfPlace(code: string, language?: string | null): string {
  const name = exportCountryName(code, language);
  if (!isFrench(language)) return name;
  const entry = EXPORT_COUNTRIES[normalizeCountryCode(code) ?? ''];
  if (!entry) return `de ${name}`;
  switch (entry.frArticle) {
    case 'le':
      return `du ${name}`;
    case 'les':
      return `des ${name}`;
    case 'la':
      return `de la ${name}`;
    default:
      return `de l’${name}`;
  }
}
