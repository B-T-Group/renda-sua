/**
 * QA #589 D1 (ReDoS) and D4 (pattern gaps). redactSecrets runs synchronously on
 * attacker-controlled text: every sampled Sentry transaction URL and every provider error
 * body. The old unanchored key/value regex took ~400 ms on 16 KB, blocking the event loop.
 */
import {
  MAX_REDACT_INPUT,
  redactProviderPayload,
  redactSecrets,
} from './sanitize-provider-error.util';

const fakeKey = (prefix: string, env: string, body: string) => [prefix, env, body].join('_');

function timeMs(fn: () => void, runs = 3): number {
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const t = process.hrtime.bigint();
    fn();
    best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6);
  }
  return best;
}

describe('D1: redactSecrets is linear and bounded', () => {
  // Budget is generous for slow CI; the quadratic regex needs ~400 ms for the 16 KB case
  // and far more without the input cap.
  const BUDGET_MS = 50;

  it.each([
    ['16 KB [\\w-] run', 'a'.repeat(16 * 1024)],
    ['16 KB hyphen run', '-'.repeat(16 * 1024)],
    ['16 KB hex (key-like)', 'ab12'.repeat(4 * 1024)],
    ['15 KB query string', '/x?' + 'q=abcdefghij'.repeat(1300)],
    ['many key-ish words', 'token '.repeat(3000)],
    ['unterminated quoted values', ('token: "' + 'a b'.repeat(10)).repeat(400)],
  ])('%s finishes under budget', (_name, input) => {
    expect(timeMs(() => redactSecrets(input))).toBeLessThan(BUDGET_MS);
  });

  it('caps the scanned input and marks the truncation', () => {
    const huge = 'x'.repeat(MAX_REDACT_INPUT * 10);
    const out = redactSecrets(huge);
    expect(out.length).toBeLessThanOrEqual(MAX_REDACT_INPUT + 20);
    expect(out.endsWith('…[truncated]')).toBe(true);
    expect(redactSecrets('short')).toBe('short');
  });

  it('a 1 MB input stays fast thanks to the cap', () => {
    const mb = ('a'.repeat(1000) + ' ').repeat(1000);
    expect(timeMs(() => redactSecrets(mb), 1)).toBeLessThan(BUDGET_MS);
  });

  it('a secret cut by the cap is still redacted (unterminated quote runs to end)', () => {
    const value = 'q'.repeat(100);
    const text = 'p'.repeat(MAX_REDACT_INPUT - 20) + `"password":"${value}"`;
    const out = redactSecrets(text);
    expect(out).not.toContain('qqqqqqqq');
    expect(out).toContain('"password":"[REDACTED]');
  });

  it('redactProviderPayload stays fast on a huge provider body', () => {
    const body = { html: 'z'.repeat(200_000) };
    expect(timeMs(() => redactProviderPayload(body))).toBeLessThan(BUDGET_MS);
    expect(redactProviderPayload(body).length).toBeLessThanOrEqual(501);
  });

  it('still redacts the forms QA probed after anchoring', () => {
    const cases: Array<[string, string]> = [
      ['{"secret_key":"v1"}', 'v1'],
      ['?access_token=v2&x=1', 'v2'],
      ['X-Secret: v3', 'v3'],
      ['"Authorization": "Token v4"', 'v4'],
      ['apiKey=v5', 'v5'],
      ['myapp_key: v6', 'v6'],
      ['a.password=v7', 'v7'],
    ];
    for (const [input, secret] of cases) expect(redactSecrets(input)).not.toContain(secret);
  });
});

describe('D4: extra patterns', () => {
  it.each([
    ['bare secret (MyPVit field name), JSON', '{"secret":"plainvalue1","expires_in":3600}', 'plainvalue1'],
    ['bare secret, query', 'a=1&secret=plainvalue2', 'plainvalue2'],
    ['client_secret, JSON', '{"client_secret":"cs-value-3"}', 'cs-value-3'],
    ['client_secret, query', 'client_secret=cs-value-4&grant=x', 'cs-value-4'],
    ['pk_live_', `key ${fakeKey('pk', 'live', 'Abc123-def')}`, 'Abc123-def'],
    ['pk_test_', `key ${fakeKey('pk', 'test', 'Xyz789')}`, 'Xyz789'],
    ['whsec_', 'sig whsec_AbC+dEf/123=', 'AbC+dEf/123='],
    ['escaped quote inside a quoted value', '{"password":"esc\\"aped-tail9"}', 'aped-tail9'],
  ])('%s', (_name, input, secret) => {
    const out = redactSecrets(input);
    expect(out).not.toContain(secret);
  });

  it('does not touch unrelated text', () => {
    for (const text of [
      'Failed to update secret AIRTEL_MYPVIT_SECRET_KEY (SyntaxError)',
      'secretName: production-rendasua-backend-secrets',
      'Request failed with status code 404',
      'Authorization: Basic REDACTED rejected',
    ]) {
      expect(redactSecrets(text)).toBe(text);
    }
  });
});
