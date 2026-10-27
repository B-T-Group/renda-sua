/**
 * MTN MoMo configuration resolution.
 *
 * MTN issues a separate subscription key (and a separate API user + API key)
 * for each product (Collection, Disbursement, Remittance), so credentials are
 * resolved per product. Base URL and target environment are independent values:
 * the target environment is what MTN receives in `X-Target-Environment`, the
 * base URL is the host that is called.
 *
 * Environment variables (all optional; values are never logged):
 *
 *   MTN_MOMO_TARGET_ENVIRONMENT        sandbox (default) | production | mtncameroon | ...
 *   MTN_MOMO_BASE_URL                  Overrides the host. Defaults: sandbox ->
 *                                      https://sandbox.momodeveloper.mtn.com,
 *                                      production -> https://proxy.momoapi.mtn.com
 *                                      (legacy). Any other target environment has NO
 *                                      default and must set this explicitly.
 *   MTN_MOMO_CURRENCY                  Default currency. Defaults: sandbox -> EUR, else XAF.
 *   MTN_MOMO_CALLBACK_URL              Public webhook URL (sent as X-Callback-Url).
 *   MTN_MOMO_WEBHOOK_SECRET            Secret used to sign per-request callback tokens.
 *   MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY / _API_USER_ID / _API_KEY
 *   MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY / _API_USER_ID / _API_KEY
 *   MTN_MOMO_REMITTANCE_SUBSCRIPTION_KEY / _API_USER_ID / _API_KEY
 *
 * Backward compatible fallbacks:
 *   - subscription key: MTN_MOMO_<PRODUCT>_SUBSCRIPTION_KEY, then
 *     MTN_MOMO_<PRODUCT>_PRIMARY_KEY, then (collection only) MTN_MOMO_SUBSCRIPTION_KEY.
 *   - collection API user / key: MTN_MOMO_API_USER_ID / MTN_MOMO_API_KEY.
 *   Disbursement and remittance never fall back to the single legacy credential set:
 *   MTN rejects it for those products (HTTP 401 on the token call).
 */
export const MTN_MOMO_PRODUCTS = [
  'collection',
  'disbursement',
  'remittance',
] as const;

export type MtnMomoProduct = (typeof MTN_MOMO_PRODUCTS)[number];

export interface MtnMomoProductCredentials {
  subscriptionKey: string;
  apiUserId: string;
  apiKey: string;
}

export interface MtnMomoConfig {
  /** Value sent in X-Target-Environment. */
  targetEnvironment: string;
  /** Host that is called; null when it must be configured explicitly. */
  baseUrl: string | null;
  /** Default currency for requests that do not carry one. */
  currency: string;
  /** Public webhook URL, or null (the X-Callback-Url header is then omitted). */
  callbackUrl: string | null;
  /** Secret that signs per-request callback tokens, or null. */
  webhookSecret: string | null;
  credentials: Record<MtnMomoProduct, MtnMomoProductCredentials>;
}

export const MTN_SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';
/** Legacy production host, used only when the target environment is `production`. */
export const MTN_LEGACY_PRODUCTION_BASE_URL = 'https://proxy.momoapi.mtn.com';

/** Currencies MTN settles without decimals. */
const ZERO_DECIMAL_CURRENCIES = new Set(['XAF', 'XOF']);

type EnvGetter = (key: string) => string | undefined;

function clean(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function first(get: EnvGetter, keys: string[]): string {
  for (const key of keys) {
    const value = clean(get(key));
    if (value) return value;
  }
  return '';
}

export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase());
}

export function resolveBaseUrl(
  targetEnvironment: string,
  explicit: string
): string | null {
  if (explicit) {
    try {
      const url = new URL(explicit);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return explicit.replace(/\/+$/, '');
    } catch {
      return null;
    }
  }
  if (targetEnvironment === 'sandbox') return MTN_SANDBOX_BASE_URL;
  if (targetEnvironment === 'production') return MTN_LEGACY_PRODUCTION_BASE_URL;
  return null;
}

export function resolveMtnMomoConfig(get: EnvGetter): MtnMomoConfig {
  const targetEnvironment =
    clean(get('MTN_MOMO_TARGET_ENVIRONMENT')).toLowerCase() || 'sandbox';
  const currency =
    clean(get('MTN_MOMO_CURRENCY')).toUpperCase() ||
    (targetEnvironment === 'sandbox' ? 'EUR' : 'XAF');

  const legacySubscriptionKey = clean(get('MTN_MOMO_SUBSCRIPTION_KEY'));
  const legacyApiUserId = clean(get('MTN_MOMO_API_USER_ID'));
  const legacyApiKey = clean(get('MTN_MOMO_API_KEY'));

  const credentialsFor = (
    product: MtnMomoProduct
  ): MtnMomoProductCredentials => {
    const prefix = `MTN_MOMO_${product.toUpperCase()}`;
    const isCollection = product === 'collection';
    return {
      subscriptionKey:
        first(get, [`${prefix}_SUBSCRIPTION_KEY`, `${prefix}_PRIMARY_KEY`]) ||
        (isCollection ? legacySubscriptionKey : ''),
      apiUserId:
        clean(get(`${prefix}_API_USER_ID`)) ||
        (isCollection ? legacyApiUserId : ''),
      apiKey:
        clean(get(`${prefix}_API_KEY`)) || (isCollection ? legacyApiKey : ''),
    };
  };

  return {
    targetEnvironment,
    baseUrl: resolveBaseUrl(targetEnvironment, clean(get('MTN_MOMO_BASE_URL'))),
    currency,
    callbackUrl: clean(get('MTN_MOMO_CALLBACK_URL')) || null,
    webhookSecret: clean(get('MTN_MOMO_WEBHOOK_SECRET')) || null,
    credentials: {
      collection: credentialsFor('collection'),
      disbursement: credentialsFor('disbursement'),
      remittance: credentialsFor('remittance'),
    },
  };
}

/** Names of the env vars still missing for a product (names only, never values). */
export function missingCredentialEnvVars(
  config: MtnMomoConfig,
  product: MtnMomoProduct
): string[] {
  const prefix = `MTN_MOMO_${product.toUpperCase()}`;
  const c = config.credentials[product];
  const missing: string[] = [];
  if (!c.subscriptionKey) missing.push(`${prefix}_SUBSCRIPTION_KEY`);
  if (!c.apiUserId) missing.push(`${prefix}_API_USER_ID`);
  if (!c.apiKey) missing.push(`${prefix}_API_KEY`);
  return missing;
}

/**
 * Amount as MTN expects it. Zero-decimal currencies (XAF/XOF) must be whole
 * numbers; a fractional amount is rejected rather than silently rounded.
 */
export function formatMtnAmount(amount: string, currency: string): string {
  const raw = String(amount ?? '').trim();
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) {
    throw new Error('amount must be a positive number');
  }
  if (isZeroDecimalCurrency(currency)) {
    if (!Number.isInteger(value)) {
      throw new Error(`amount must be a whole number for ${currency}`);
    }
    return String(value);
  }
  return raw;
}
