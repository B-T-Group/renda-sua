/** Bump only for major FTUE redesigns that should re-trigger for existing users. */
export const ONBOARDING_VERSION = 1;

export type PersonaIntent = 'buy' | 'sell' | 'deliver' | 'explore';

export type OnboardingOutcome = 'completed' | 'skipped';

export type OnboardingScreenId =
  | 'marketplace'
  | 'merchant'
  | 'payments'
  | 'intent';

export const NUDGE_IDS = {
  sellHere: 'sell-here',
  saveFavorites: 'save-favorites',
  becomeCourier: 'become-courier',
  saveCart: 'save-cart',
  postOrderAccount: 'post-order-account',
} as const;

/** Merchant dashboard tip / celebration ids (FtueStore keys). */
export const MERCHANT_TIP_NUDGE_PREFIX = 'merchant-tip:' as const;

export type NudgeId = (typeof NUDGE_IDS)[keyof typeof NUDGE_IDS];

/** Max nudges shown in a single app session. */
export const NUDGE_MAX_PER_SESSION = 2;

/** Days before a dismissed nudge can reappear (unless permanently dismissed). */
export const NUDGE_COOLDOWN_DAYS = 30;

/** Permanent dismiss after this many explicit dismissals. */
export const NUDGE_PERMANENT_DISMISS_AFTER = 2;

/** Product views before save-favorites / sell-here can fire. */
export const NUDGE_PRODUCT_VIEWS_THRESHOLD = 5;

/** Hero carousel auto-advance interval (ms). */
export const HERO_AUTO_ADVANCE_MS = 6000;

/** Experiment: skip button timing. */
export const EXPERIMENT_SKIP_TIMING = 'ftue_skip_timing_v1' as const;
