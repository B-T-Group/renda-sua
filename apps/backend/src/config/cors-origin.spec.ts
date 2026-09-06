import { isCorsOriginAllowed, parseCorsOrigins } from './cors-origin';

describe('parseCorsOrigins', () => {
  it('always includes production origins even when CORS_ORIGIN is unset', () => {
    const actual = parseCorsOrigins(undefined);
    expect(actual).toContain('https://www.rendasua.com');
    expect(actual).toContain('https://rendasua.com');
    expect(actual).toContain('http://localhost:4200');
  });

  it('always includes production origins even when CORS_ORIGIN is localhost-only', () => {
    const actual = parseCorsOrigins('http://localhost:4200');
    expect(actual).toContain('https://www.rendasua.com');
    expect(actual).toContain('https://rendasua.com');
    expect(actual).toContain('http://localhost:4200');
  });

  it('merges production origins with CORS_ORIGIN environment value', () => {
    const actual = parseCorsOrigins('https://dev.rendasua.com, http://localhost:4200');
    expect(actual).toContain('https://www.rendasua.com');
    expect(actual).toContain('https://rendasua.com');
    expect(actual).toContain('https://dev.rendasua.com');
    expect(actual).toContain('http://localhost:4200');
  });

  it('deduplicates origins when CORS_ORIGIN includes production origins', () => {
    const actual = parseCorsOrigins('https://www.rendasua.com, https://rendasua.com');
    const wwwCount = actual.filter((o) => o === 'https://www.rendasua.com').length;
    const apexCount = actual.filter((o) => o === 'https://rendasua.com').length;
    expect(wwwCount).toBe(1);
    expect(apexCount).toBe(1);
  });

  it('keeps a wildcard token as a single entry', () => {
    const actual = parseCorsOrigins('*');
    expect(actual).toContain('*');
    expect(actual).toContain('https://www.rendasua.com');
    expect(actual).toContain('https://rendasua.com');
  });
});

describe('isCorsOriginAllowed', () => {
  it('allows requests with no Origin header (non-browser clients)', () => {
    expect(isCorsOriginAllowed(undefined, ['https://www.rendasua.com'])).toBe(true);
    expect(isCorsOriginAllowed(undefined, ['*'])).toBe(true);
  });

  it('rejects empty-string Origin', () => {
    expect(isCorsOriginAllowed('', ['https://dev.rendasua.com'])).toBe(false);
  });

  it('allows any origin when the allowlist includes a wildcard', () => {
    expect(isCorsOriginAllowed('https://dev.rendasua.com', ['*'])).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:4200', ['*'])).toBe(true);
  });

  it('allows only exact allowlist matches without a wildcard', () => {
    const allowlist = ['https://dev.rendasua.com', 'http://localhost:4200'];
    expect(isCorsOriginAllowed('https://dev.rendasua.com', allowlist)).toBe(true);
    expect(isCorsOriginAllowed('https://rendasua.com', allowlist)).toBe(false);
  });

  it('allows production origins when they are in the allowlist', () => {
    const allowlist = parseCorsOrigins(undefined);
    expect(isCorsOriginAllowed('https://www.rendasua.com', allowlist)).toBe(true);
    expect(isCorsOriginAllowed('https://rendasua.com', allowlist)).toBe(true);
  });
});
