/** Retourne la clé i18n pour un message d’erreur Auth0 / flux auth. */
export function getAuthFlowErrorKey(error: string | null): string {
  if (!error) return 'auth.errors.generic';
  const lower = error.toLowerCase();
  // Deferred signup attempt-specific errors (must check before generic "too many" / "expired")
  if (lower.includes('signup attempt missing')) return 'auth.signupFlow.attemptMissing';
  if (lower.includes('signup attempt expired')) return 'auth.signupFlow.attemptExpired';
  if (lower.includes('signup attempt is busy')) return 'auth.signupFlow.attemptBusy';
  if (lower.includes('too many verification attempts')) return 'auth.signupFlow.tooManyAttempts';
  if (lower.includes('invalid_grant')) return 'auth.errors.invalidOtp';
  if (
    lower.includes('signup attempt expired') ||
    lower.includes('verification session expired') ||
    lower.includes('too many invalid codes') ||
    lower.includes('start signup again') ||
    lower.includes('start again')
  )
    return 'auth.signupFlow.attemptExpired';
  if (
    lower.includes('wait before requesting') ||
    (lower.includes('resend') && lower.includes('wait'))
  )
    return 'auth.signupFlow.resendCooldown';
  if (lower.includes('too many') || lower.includes('trop de') || lower.includes('attempts'))
    return 'auth.errors.tooManyAttempts';
  if (
    lower.includes('otp') ||
    (lower.includes('code') &&
      (lower.includes('invalid') ||
        lower.includes('wrong') ||
        lower.includes('incorrect') ||
        lower.includes('expired')))
  )
    return 'auth.errors.invalidOtp';
  if (
    lower.includes('incorrect') ||
    lower.includes('invalid') ||
    lower.includes('wrong') ||
    lower.includes('identifiant') ||
    lower.includes('password') ||
    lower.includes('credentials')
  )
    return 'auth.errors.invalidCredentials';
  if (lower.includes('blocked') || lower.includes('bloqué')) return 'auth.errors.blocked';
  // Browser blocked response (often CORS) — SMS may still be delivered server-side.
  if (
    lower.includes('failed to fetch') ||
    lower.includes('load failed') ||
    lower.includes('networkerror when attempting') ||
    lower.includes('network request failed')
  )
    return 'auth.errors.browserOrCors';
  if (
    lower.includes('network') ||
    lower.includes('réseau') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('connexion refusée') ||
    lower.includes('connection refused')
  )
    return 'auth.errors.network';
  return 'auth.errors.generic';
}
