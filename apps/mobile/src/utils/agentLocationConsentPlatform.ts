import { Platform } from 'react-native';
import type { AgentLocationTrackingConsent } from '../types/agentLocationConsent';
import type { MeUser } from '../types/me';

export type LocationConsentPlatform = 'ios' | 'android';

export function getLocationConsentPlatform(): LocationConsentPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export function getAgentLocationConsentForPlatform(
  agent: MeUser['agent'] | null | undefined
): AgentLocationTrackingConsent | undefined {
  const platform = getLocationConsentPlatform();
  return platform === 'ios'
    ? agent?.location_tracking_consent_ios
    : agent?.location_tracking_consent_android;
}

export function getAgentLocationConsentFromResponse(
  agent:
    | {
        location_tracking_consent_ios?: string;
        location_tracking_consent_android?: string;
      }
    | null
    | undefined
): AgentLocationTrackingConsent | undefined {
  return getAgentLocationConsentForPlatform(agent);
}
