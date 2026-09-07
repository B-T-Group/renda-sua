export type AgentLocationTrackingConsent = 'not_shown' | 'accepted' | 'deferred';

export const AGENT_LOCATION_TRACKING_CONSENT_VALUES: AgentLocationTrackingConsent[] = [
  'not_shown',
  'accepted',
  'deferred',
];

export function isAgentLocationTrackingConsent(
  value: string | undefined | null
): value is AgentLocationTrackingConsent {
  return (
    !!value &&
    (AGENT_LOCATION_TRACKING_CONSENT_VALUES as string[]).includes(value)
  );
}
