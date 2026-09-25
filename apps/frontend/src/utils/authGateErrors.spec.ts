import {
  mapPasswordLoginError,
  parseLockoutFromError,
} from './authGateErrors';

const t = (key: string, def: string, opts?: Record<string, unknown>) => {
  if (opts?.minutes) return def.replace('{{minutes}}', String(opts.minutes));
  return def;
};

describe('authGateErrors', () => {
  it('maps wrong password to neutral copy', () => {
    const msg = mapPasswordLoginError({ response: { status: 401 } }, t);
    expect(msg).toBe("That email or password isn't right.");
  });

  it('parses lockout from 429 with retry-after', () => {
    const lockout = parseLockoutFromError({
      response: { status: 429, headers: { 'retry-after': '120' } },
    });
    expect(lockout?.remainingMs).toBe(120_000);
  });
});
