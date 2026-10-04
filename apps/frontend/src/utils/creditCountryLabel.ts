const COUNTRY_LABELS: Record<string, readonly [string, string]> = {
  CM: ['admin.credits.countries.CM', 'Cameroon'],
  GA: ['admin.credits.countries.GA', 'Gabon'],
  TG: ['admin.credits.countries.TG', 'Togo'],
  BJ: ['admin.credits.countries.BJ', 'Benin'],
  CI: ['admin.credits.countries.CI', "Côte d'Ivoire"],
  CG: ['admin.credits.countries.CG', 'Congo'],
  CA: ['admin.credits.countries.CA', 'Canada'],
  US: ['admin.credits.countries.US', 'United States'],
  PH: ['admin.credits.countries.PH', 'Philippines'],
};

type Translate = (key: string, fallback: string) => string;

/** Ops follow-ups label. Unknown markets show the code; blank stays an em dash. */
export function creditCountryLabel(
  code: string | null | undefined,
  t: Translate
): string {
  if (!code) return '—';
  const normalized = code.toUpperCase();
  const entry = COUNTRY_LABELS[normalized];
  return entry ? t(entry[0], entry[1]) : normalized;
}
