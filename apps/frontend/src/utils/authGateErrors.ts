export function mapAuthGateApiError(
  err: any,
  t: (key: string, def: string) => string
): string {
  const data = err?.response?.data;
  const code = data?.code as string | undefined;
  if (code === 'AUTH_REQUEST_FAILED') {
    return t(
      'auth.gate.requestFailed',
      'We could not complete that request. Please try again.'
    );
  }
  const retryAfter = data?.retryAfterSeconds ?? err?.response?.headers?.['retry-after'];
  if (retryAfter) {
    return t(
      'auth.gate.tooManyAttempts',
      'Too many attempts. Please wait a moment and try again.'
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
