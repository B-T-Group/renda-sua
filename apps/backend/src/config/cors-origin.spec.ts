import { isCorsOriginAllowed, parseCorsOrigins } from './cors-origin';

describe('parseCorsOrigins', () => {
  it('defaults to local frontend when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:4200']);
  });

  it('splits a comma-separated allowlist and trims entries', () => {
    expect(
      parseCorsOrigins(' https://dev.rendasua.com, http://localhost:4200 ')
    ).toEqual(['https://dev.rendasua.com', 'http://localhost:4200']);
  });

  it('keeps a wildcard token as a single entry', () => {
    expect(parseCorsOrigins('*')).toEqual(['*']);
  });
});

describe('isCorsOriginAllowed', () => {
  it('rejects requests with no Origin header', () => {
    expect(isCorsOriginAllowed(undefined, ['*'])).toBe(false);
    expect(isCorsOriginAllowed('', ['https://dev.rendasua.com'])).toBe(false);
  });

  it('allows any origin when the allowlist includes a wildcard', () => {
    expect(
      isCorsOriginAllowed('https://dev.rendasua.com', ['*'])
    ).toBe(true);
    expect(isCorsOriginAllowed('http://localhost:4200', ['*'])).toBe(true);
  });

  it('allows only exact allowlist matches without a wildcard', () => {
    const allowlist = ['https://dev.rendasua.com', 'http://localhost:4200'];
    expect(isCorsOriginAllowed('https://dev.rendasua.com', allowlist)).toBe(
      true
    );
    expect(isCorsOriginAllowed('https://rendasua.com', allowlist)).toBe(false);
  });
});
