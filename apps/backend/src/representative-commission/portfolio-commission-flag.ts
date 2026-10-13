export const PORTFOLIO_COMMISSION_FLAG =
  'representative_portfolio_commission_enabled';

/** Production orders before this instant keep the 1% and first-sale bonus. */
export const PORTFOLIO_COMMISSION_CUTOVER = '2026-11-01T00:00:00.000+01:00';

export function portfolioCommissionApplies(
  enabled: boolean,
  at: Date = new Date()
): boolean {
  if (!enabled) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return at.getTime() >= Date.parse(PORTFOLIO_COMMISSION_CUTOVER);
}

/** Legacy 1% / first-sale pay stays until a grid can actually replace it. */
export function shouldReplaceLegacySalePay(
  enabled: boolean,
  at: Date,
  hasGrid: boolean
): boolean {
  return hasGrid && portfolioCommissionApplies(enabled, at);
}

type FlagRow = { boolean_value?: boolean; status?: string } | null;

type ConfigLookups = {
  getConfigurationByKey: (key: string, country?: string) => Promise<FlagRow>;
  getGlobalConfigurationByKey: (key: string) => Promise<FlagRow>;
};

/**
 * Flag reader for readPortfolioEnabled: a country lookup when a country is
 * given, otherwise strictly the global row (country_code IS NULL). A CM-only
 * row must never be read as the default for CA/US agents.
 */
export function flagReader(
  configurations: ConfigLookups
): (key: string, country?: string) => Promise<FlagRow> {
  return (key, country) =>
    country
      ? configurations.getConfigurationByKey(key, country)
      : configurations.getGlobalConfigurationByKey(key);
}

/** `read(key, undefined)` must return only the country_code IS NULL row (see flagReader). */
export async function readPortfolioEnabled(
  read: (key: string, country?: string) => Promise<FlagRow>,
  country: string | null
): Promise<boolean> {
  const scoped = country ? await readFlag(read, country) : null;
  const config = scoped ?? (await readFlag(read, undefined));
  return config?.boolean_value === true && config?.status === 'active';
}

async function readFlag(
  read: (key: string, country?: string) => Promise<FlagRow>,
  country: string | undefined
): Promise<FlagRow> {
  try {
    return await read(PORTFOLIO_COMMISSION_FLAG, country);
  } catch {
    return null;
  }
}
