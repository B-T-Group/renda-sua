import { resolveTrustProxy } from './resolve-trust-proxy';

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
