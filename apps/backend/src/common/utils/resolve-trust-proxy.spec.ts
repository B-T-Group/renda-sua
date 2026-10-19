import { assertProductionTrustProxy, resolveTrustProxy } from './resolve-trust-proxy';

describe('resolveTrustProxy', () => {
  const nodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  it('defaults to loopback outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(resolveTrustProxy(undefined)).toBe('loopback');
    expect(resolveTrustProxy('')).toBe('loopback');
  });

  it('defaults to hop count 1 in production', () => {
    process.env.NODE_ENV = 'production';
    expect(resolveTrustProxy(undefined)).toBe(1);
  });

  it('parses hop counts', () => {
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy('2')).toBe(2);
  });

  it('parses Express keywords', () => {
    expect(resolveTrustProxy('loopback')).toBe('loopback');
    expect(resolveTrustProxy('TRUE')).toBe('true');
    expect(resolveTrustProxy('false')).toBe('false');
  });

  it('parses comma-separated CIDR lists', () => {
    expect(resolveTrustProxy('10.0.0.0/8, 127.0.0.1')).toEqual([
      '10.0.0.0/8',
      '127.0.0.1',
    ]);
  });

  it('passes through a single CIDR', () => {
    expect(resolveTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
  });
});

describe('QA #593: production must trust exactly one proxy hop', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, DEPLOYMENT_ENV: process.env.DEPLOYMENT_ENV };
  afterEach(() => {
    process.env.NODE_ENV = saved.NODE_ENV;
    if (saved.DEPLOYMENT_ENV === undefined) delete process.env.DEPLOYMENT_ENV;
    else process.env.DEPLOYMENT_ENV = saved.DEPLOYMENT_ENV;
  });

  it('prod with TRUST_PROXY unset (as deployed) resolves to 1 and passes', () => {
    process.env.NODE_ENV = 'production';
    const resolved = resolveTrustProxy(undefined);
    expect(resolved).toBe(1);
    expect(() => assertProductionTrustProxy(resolved, { NODE_ENV: 'production' })).not.toThrow();
    expect(() => assertProductionTrustProxy(resolveTrustProxy('1'), { NODE_ENV: 'production' })).not.toThrow();
  });

  it('DEPLOYMENT_ENV=production alone also defaults to 1', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEPLOYMENT_ENV = 'production';
    expect(resolveTrustProxy(undefined)).toBe(1);
  });

  it.each(['true', '2', 'loopback', '10.0.0.0/8, 172.16.0.0/12', 'false'])(
    'refuses to start in production with TRUST_PROXY=%s',
    (raw) => {
      expect(() =>
        assertProductionTrustProxy(resolveTrustProxy(raw), { NODE_ENV: 'production' })
      ).toThrow(/trust proxy must be 1 in production/);
      expect(() =>
        assertProductionTrustProxy(resolveTrustProxy(raw), { DEPLOYMENT_ENV: 'production' })
      ).toThrow(/trust proxy must be 1 in production/);
    }
  );

  it('does not constrain non-production', () => {
    expect(() => assertProductionTrustProxy('true', { NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertProductionTrustProxy('loopback', {})).not.toThrow();
  });
});

describe('main.ts wires the production trust-proxy assertion', () => {
  it('asserts before app.set("trust proxy") (static check of the bootstrap)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path');
    const main: string = readFileSync(join(__dirname, '..', '..', 'main.ts'), 'utf8');
    const assertAt = main.indexOf('assertProductionTrustProxy(trustProxy);');
    const setAt = main.indexOf("app.set('trust proxy', trustProxy);");
    expect(assertAt).toBeGreaterThan(-1);
    expect(setAt).toBeGreaterThan(assertAt);
  });
});
