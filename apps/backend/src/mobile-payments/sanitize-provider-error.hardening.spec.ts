/** M1 (sanitizer never throws) and L1 (redaction coverage) from the #589 QA review. */
import { redactSecrets, sanitizeProviderError, safeStringify } from './sanitize-provider-error.util';

const fakeKey = (env: string, body: string) => ['sk', env, body].join('_');

describe('M1: sanitizeProviderError stringifies non-string messages and never throws', () => {
  it.each([
    ['object', { message: { detail: 'bad', key: fakeKey('live', 'abc') } }, '{"detail":"bad","key":"sk_live_REDACTED"}'],
    ['number', { msg: 42, status: 502 }, '42'],
    ['array', { message: ['a', `Bearer x+y/z==`] }, '["a","Bearer REDACTED"]'],
  ])('%s message', (_label, error, expected) => {
    const out = sanitizeProviderError(error);
    expect(out.message).toBe(expected);
  });

  it('keeps status and code when the message is not a string', () => {
    expect(sanitizeProviderError({ msg: { x: 1 }, status: 502, code: 'E1' })).toEqual({ message: '{"x":1}', status: 502, code: 'E1' });
  });

  it('a circular message falls back instead of throwing', () => {
    const c: any = { a: 1 };
    c.self = c;
    expect(() => sanitizeProviderError({ message: c, status: 500 })).not.toThrow();
    expect(sanitizeProviderError({ message: c, status: 500 }).status).toBe(500);
  });

  it('an error whose message getter throws falls back to a placeholder', () => {
    const evil = Object.defineProperty({ status: 503 }, 'message', { get() { throw new Error('boom'); } });
    expect(sanitizeProviderError(evil)).toEqual({ message: '[unprintable error]', status: 503 });
  });

  it('safeStringify never throws', () => {
    const c: any = {};
    c.c = c;
    expect(typeof safeStringify(c)).toBe('string');
    expect(safeStringify(undefined)).toBe('');
    expect(safeStringify(12)).toBe('12');
  });
});

describe('L1: redactSecrets coverage', () => {
  it.each([
    ['Bearer with + / =', 'Bearer ab+cd/ef==', 'Bearer REDACTED'],
    ['Bearer JWT', 'Bearer eyJh.eyJz.sig-_~', 'Bearer REDACTED'],
    ['sk_ with dash', `${fakeKey('live', 'AbC-123-xyz')} tail`, 'sk_live_REDACTED tail'],
    ['sk_sandbox', fakeKey('sandbox', 'q-w_e'), 'sk_sandbox_REDACTED'],
    ['JSON secret_key', '{"secret_key":"v1","x":1}', '{"secret_key":"[REDACTED]","x":1}'],
    ['JSON new_secret_key', '{"new_secret_key":"v2"}', '{"new_secret_key":"[REDACTED]"}'],
    ['header X-Secret', 'X-Secret: v3', 'X-Secret: [REDACTED]'],
    ['JSON X-Secret', '{"X-Secret":"v3"}', '{"X-Secret":"[REDACTED]"}'],
    ['apiKey query', 'a=1&apiKey=v4&b=2', 'a=1&apiKey=[REDACTED]&b=2'],
    ['app_key', '{"app_key":"v5"}', '{"app_key":"[REDACTED]"}'],
    ['secretKey', "{secretKey: 'v6'}", "{secretKey: '[REDACTED]'}"],
    ['password', 'password=v7', 'password=[REDACTED]'],
    ['token', '{"token":"v8"}', '{"token":"[REDACTED]"}'],
    ['access_token', 'access_token=v9', 'access_token=[REDACTED]'],
    ['non-Basic Authorization', '"Authorization":"Token v10"', '"Authorization":"[REDACTED]"'],
    ['Basic stays readable', 'Authorization: Basic Zm9vOmJhcg== rejected', 'Authorization: Basic REDACTED rejected'],
  ])('%s', (_label, input, expected) => {
    expect(redactSecrets(input)).toBe(expected);
  });

  it('leaves unrelated text alone', () => {
    expect(redactSecrets('tokens: 5, keyboard: ok, status 401')).toBe('tokens: 5, keyboard: ok, status 401');
  });
});
