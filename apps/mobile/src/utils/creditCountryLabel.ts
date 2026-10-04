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

export interface CreditCountryLabelParts {
  key: string;
  fallback: string;
}

type Translate = (key: string, fallback: string) => string;

/** Translation key + fallback for an ops market. Unknown codes stay renderable. */
export function creditCountryLabelParts(
  isoCode: string
): CreditCountryLabelParts {
  const entry = COUNTRY_LABELS[isoCode];
  return {
    key: entry?.[0] ?? `admin.credits.countries.${isoCode}`,
    fallback: entry?.[1] ?? isoCode,
  };
}

export function creditCountryLabel(isoCode: string, t: Translate): string {
  const parts = creditCountryLabelParts(isoCode);
  return t(parts.key, parts.fallback);
}
