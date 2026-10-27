import {
  formatMtnAmount,
  missingCredentialEnvVars,
  resolveMtnMomoConfig,
} from './mtn-momo.config';
import {
  signMtnWebhookToken,
  verifyMtnWebhookToken,
} from './mtn-momo-webhook-token.util';

const cfg = (env: Record<string, string>) =>
  resolveMtnMomoConfig((k) => env[k]);

describe('resolveMtnMomoConfig', () => {
  it('defaults to sandbox, EUR and the sandbox host', () => {
    const c = cfg({});
    expect(c.targetEnvironment).toBe('sandbox');
    expect(c.currency).toBe('EUR');
    expect(c.baseUrl).toBe('https://sandbox.momodeveloper.mtn.com');
    expect(c.callbackUrl).toBeNull();
    expect(c.webhookSecret).toBeNull();
  });

  it('keeps the legacy production host only for target environment "production"', () => {
    const c = cfg({ MTN_MOMO_TARGET_ENVIRONMENT: 'production' });
    expect(c.baseUrl).toBe('https://proxy.momoapi.mtn.com');
    expect(c.currency).toBe('XAF');
  });

  it('treats base URL and target environment as separate values', () => {
    const c = cfg({
      MTN_MOMO_TARGET_ENVIRONMENT: 'MTNCameroon',
      MTN_MOMO_BASE_URL: 'https://momoapi.momo.africa/',
    });
    expect(c.targetEnvironment).toBe('mtncameroon');
    expect(c.baseUrl).toBe('https://momoapi.momo.africa');
  });

  it('has no default host for other target environments, and rejects a bad URL', () => {
    expect(
      cfg({ MTN_MOMO_TARGET_ENVIRONMENT: 'mtncameroon' }).baseUrl
    ).toBeNull();
    expect(
      cfg({
        MTN_MOMO_TARGET_ENVIRONMENT: 'mtncameroon',
        MTN_MOMO_BASE_URL: 'not a url',
      }).baseUrl
    ).toBeNull();
    expect(cfg({ MTN_MOMO_BASE_URL: 'ftp://example.com' }).baseUrl).toBeNull();
  });

  it('lets MTN_MOMO_CURRENCY override the default', () => {
    expect(cfg({ MTN_MOMO_CURRENCY: 'xaf' }).currency).toBe('XAF');
  });

  it('resolves subscription key: product key, then PRIMARY_KEY, then legacy (collection only)', () => {
    const c = cfg({
      MTN_MOMO_SUBSCRIPTION_KEY: 'legacy',
      MTN_MOMO_COLLECTION_PRIMARY_KEY: 'col-primary',
      MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY: 'dis-explicit',
      MTN_MOMO_DISBURSEMENT_PRIMARY_KEY: 'dis-primary',
    });
    expect(c.credentials.collection.subscriptionKey).toBe('col-primary');
    expect(c.credentials.disbursement.subscriptionKey).toBe('dis-explicit');
    expect(c.credentials.remittance.subscriptionKey).toBe('');
  });

  it('only collection inherits the legacy API user and key', () => {
    const c = cfg({
      MTN_MOMO_SUBSCRIPTION_KEY: 'legacy-sub',
      MTN_MOMO_API_USER_ID: 'legacy-user',
      MTN_MOMO_API_KEY: 'legacy-key',
    });
    expect(c.credentials.collection).toEqual({
      subscriptionKey: 'legacy-sub',
      apiUserId: 'legacy-user',
      apiKey: 'legacy-key',
    });
    expect(missingCredentialEnvVars(c, 'disbursement')).toEqual([
      'MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY',
      'MTN_MOMO_DISBURSEMENT_API_USER_ID',
      'MTN_MOMO_DISBURSEMENT_API_KEY',
    ]);
    expect(missingCredentialEnvVars(c, 'collection')).toEqual([]);
  });
});

describe('formatMtnAmount', () => {
  it('keeps decimals for EUR', () => {
    expect(formatMtnAmount('10.50', 'EUR')).toBe('10.50');
  });
  it('requires whole numbers for XAF/XOF', () => {
    expect(formatMtnAmount('1500', 'XAF')).toBe('1500');
    expect(() => formatMtnAmount('1500.5', 'xaf')).toThrow('whole number');
    expect(() => formatMtnAmount('100.25', 'XOF')).toThrow('whole number');
  });
  it('rejects non-positive or non-numeric amounts', () => {
    expect(() => formatMtnAmount('0', 'EUR')).toThrow();
    expect(() => formatMtnAmount('abc', 'EUR')).toThrow();
    expect(() => formatMtnAmount('', 'EUR')).toThrow();
  });
});

describe('MTN webhook token', () => {
  const ref = '3f1c6a52-8f0e-4c0a-9a53-0e1c8f7a2b11';
  it('round-trips and is bound to secret and reference', () => {
    const token = signMtnWebhookToken('s1', ref);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyMtnWebhookToken('s1', ref, token)).toBe(true);
    expect(verifyMtnWebhookToken('s2', ref, token)).toBe(false);
    expect(
      verifyMtnWebhookToken('s1', '9b2d8a10-1111-4c0a-9a53-0e1c8f7a2b22', token)
    ).toBe(false);
  });
  it('is case-insensitive on the reference and never throws on bad input', () => {
    const token = signMtnWebhookToken('s1', ref);
    expect(verifyMtnWebhookToken('s1', ref.toUpperCase(), token)).toBe(true);
    for (const bad of [undefined, null, 42, {}, [], '', 'zz'.repeat(32)]) {
      expect(verifyMtnWebhookToken('s1', ref, bad)).toBe(false);
    }
    expect(verifyMtnWebhookToken(null, ref, token)).toBe(false);
  });
});
