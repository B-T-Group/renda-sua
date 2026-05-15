/**
 * True when push is globally enabled and the user has at least one deliverable
 * channel (Expo tokens and/or web push with VAPID configured + subscriptions).
 */
export function userHasRegisteredPushChannels(
  pushEnabled: boolean,
  hasValidExpoToken: boolean,
  webSubscriptionCount: number,
  vapidConfigured: boolean
): boolean {
  if (!pushEnabled) return false;
  if (hasValidExpoToken) return true;
  return vapidConfigured && webSubscriptionCount > 0;
}
