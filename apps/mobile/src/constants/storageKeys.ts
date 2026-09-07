/**
 * Central AsyncStorage key registry. Prefer these constants over inline strings
 * when adding new persisted state.
 */

export const STORAGE_KEYS = {
  ftue: '@RendasuaAgent:ftue:v1',
  firstOrderJourney: '@RendasuaAgent:firstOrderJourney:v1',
  rsAnonymousId: '@RendasuaAgent:rs_anon_id',
  contactNudgeDismissed: '@RendasuaAgent:nudge:contactDismissed',
  agentWentAvailable: '@RendasuaAgent:ftue:agentWentAvailable',
  shoppingCart: '@RendasuaAgent:shoppingCart',
  language: '@BTGroupe:language',
  /** Opaque deferred-signup attempt id — held until OTP verification completes. */
  pendingSignupAttemptId: '@RendasuaAgent:pendingSignupAttemptId',
  /** Post-signup welcome state (promo + persona) — survives restart until welcome dismissed. */
  pendingSignupWelcome: '@RendasuaAgent:pendingSignupWelcome',
} as const;
