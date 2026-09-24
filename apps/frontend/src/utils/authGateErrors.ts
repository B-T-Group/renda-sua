import { lockoutMinutesFromMs } from './authGateLockoutStorage';

export function mapAuthGateApiError(
  err: any,
  t: (key: string, def: string, opts?: Record<string, unknown>) => string
): string {
  const data = err?.response?.data;
  const code = data?.code as string | undefined;
  if (code === 'AUTH_REQUEST_FAILED') {
    return t(
      'auth.gate.requestFailed',
      'We could not complete that request. Please try again.'
    );
  }
  const lockout = parseLockoutFromError(err);
  if (lockout) {
    return t(
      'auth.gate.lockoutMessage',
      'Too many attempts. For your security, please wait {{minutes}} min before trying again.',
      { minutes: lockoutMinutesFromMs(lockout.remainingMs) }
    );
  }
  const retryAfter =
    data?.retryAfterSeconds ?? err?.response?.headers?.['retry-after'];
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const minutes = Number.isFinite(seconds)
      ? Math.max(1, Math.ceil(seconds / 60))
      : 1;
    return t(
      'auth.gate.tooManyAttemptsCooldown',
      "You've asked for too many codes. Try again in {{minutes}} min.",
      { minutes }
    );
  }
  const msg = data?.error ?? data?.message;
  if (typeof msg === 'string' && /user not found/i.test(msg)) {
    return t(
      'auth.gate.requestFailed',
      'We could not complete that request. Please try again.'
    );
  }
  return (
    (typeof msg === 'string' ? msg : null) ||
    t('auth.gate.genericError', 'Something went wrong. Please try again.')
  );
}

export function mapPasswordLoginError(
  err: any,
  t: (key: string, def: string, opts?: Record<string, unknown>) => string
): string {
  const lockout = parseLockoutFromError(err);
  if (lockout) {
    return t(
      'auth.gate.lockoutMessage',
      'Too many attempts. For your security, please wait {{minutes}} min before trying again.',
      { minutes: lockoutMinutesFromMs(lockout.remainingMs) }
    );
  }
  const status = err?.response?.status;
  if (status === 401 || status === 403 || status === 400) {
    return t(
      'auth.gate.wrongPassword',
      "That email or password isn't right."
    );
  }
  return mapAuthGateApiError(err, t);
}

export function parseLockoutFromError(
  err: any
): { lockedUntilMs: number; remainingMs: number } | null {
  const status = err?.response?.status;
  if (status !== 429) return null;
  const data = err?.response?.data;
  const retryAfterRaw =
    data?.retryAfterSeconds ?? err?.response?.headers?.['retry-after'];
  const retryAfterSeconds = Number(retryAfterRaw);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    const remainingMs = retryAfterSeconds * 1000;
    return { remainingMs, lockedUntilMs: Date.now() + remainingMs };
  }
  const msg = String(data?.error ?? data?.message ?? '');
  const match = msg.match(/(\d+)\s+minute/i);
  if (match) {
    const minutes = Number(match[1]);
    if (Number.isFinite(minutes) && minutes > 0) {
      const remainingMs = minutes * 60_000;
      return { remainingMs, lockedUntilMs: Date.now() + remainingMs };
    }
  }
  const remainingMs = 15 * 60_000;
  return { remainingMs, lockedUntilMs: Date.now() + remainingMs };
}
