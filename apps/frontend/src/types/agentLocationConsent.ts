export const AGENT_LOCATION_TRACKING_CONSENT_VALUES = [
  'not_shown',
  'accepted_fg',
  'accepted_bg',
  'rejected',
  'deferred',
] as const;

export type AgentLocationTrackingConsent =
  (typeof AGENT_LOCATION_TRACKING_CONSENT_VALUES)[number];

export function normalizeAgentLocationTrackingConsent(
  value: unknown
): AgentLocationTrackingConsent {
  if (
    typeof value === 'string' &&
    (AGENT_LOCATION_TRACKING_CONSENT_VALUES as readonly string[]).includes(value)
  ) {
    return value as AgentLocationTrackingConsent;
  }
  return 'not_shown';
}

export function hasAcceptedLocationTrackingConsent(value: unknown): boolean {
  const consent = normalizeAgentLocationTrackingConsent(value);
  return consent === 'accepted_fg' || consent === 'accepted_bg';
}

export function hasAcceptedBackgroundLocationTrackingConsent(
  value: unknown
): boolean {
  return normalizeAgentLocationTrackingConsent(value) === 'accepted_bg';
}
