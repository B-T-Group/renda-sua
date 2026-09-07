/**
 * Feature flags — keep in sync with web `apps/frontend/src/constants/appFeatures.ts`
 * where behaviour should match.
 */
export const APP_FEATURES = {
  /** When false (web default), agents go picked_up → out_for_delivery without an in_transit step on the detail actions. */
  AGENT_MARK_AS_IN_TRANSIT: false,
} as const;
