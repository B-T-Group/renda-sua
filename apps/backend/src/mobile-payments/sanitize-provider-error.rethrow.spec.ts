/** Rethrow and phone-mask leftovers from the #589 secret-logging hotfix. */
import { maskPhoneNumber, toSanitizedError } from './sanitize-provider-error.util';

const LIVE = ['sk', 'live', 'supersecretvalue'].join('_');

function dump(err: any): string {
  return JSON.stringify({
    message: err.message,
    status: err.status,
    code: err.code,
    response: err.response,
    config: err.config,
    request: err.request,
  });
}

describe('toSanitizedError drops provider credentials on rethrow', () => {
  it('keeps axios status and error_code, and drops body, headers, and config', () => {
    const raw = Object.assign(new Error(`denied Bearer ${LIVE}`), {
      response: {
        status: 401,
        data: { secret_key: 'raw-secret-value', token: 'tok-9' },
        headers: { authorization: `Bearer ${LIVE}` },
      },
      config: { headers: { 'X-Secret': 'header-secret', Authorization: 'Basic abcdef==' } },
      request: { _header: 'Authorization: Basic abcdef==' },
      error_code: 'AUTH',
    });

    const err = toSanitizedError(raw) as any;

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('denied Bearer REDACTED');
    expect(err.status).toBe(401);
    expect(err.response).toEqual({ status: 401 });
    expect(err.code).toBe('AUTH');
    expect(err.config).toBeUndefined();
    expect(err.request).toBeUndefined();
    const text = dump(err);
    expect(text).not.toContain('raw-secret-value');
    expect(text).not.toContain('header-secret');
    expect(text).not.toContain('tok-9');
    expect(text).not.toContain(LIVE);
    expect(text).not.toContain('abcdef');
  });

  it('returns a placeholder when the error is missing', () => {
    const missing = toSanitizedError(null) as any;
    expect(missing.message).toBe('Unknown error');
    expect(missing.status).toBeUndefined();
    expect(missing.code).toBeUndefined();
    expect(toSanitizedError(undefined).message).toBe('Unknown error');
  });
});

describe('maskPhoneNumber', () => {
  it.each([
    [undefined, ''],
    ['', ''],
    ['12', '***'],
    ['+++', '***'],
    ['+237', '***'],
    ['1234', '***234'],
    ['+237677123456', '***456'],
    ['+237 677-123-456', '***456'],
  ])('%s → %s', (input, expected) => {
    expect(maskPhoneNumber(input)).toBe(expected);
  });
});
