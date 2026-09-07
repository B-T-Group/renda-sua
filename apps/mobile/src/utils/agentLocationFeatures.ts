import * as Location from 'expo-location';
import type { AgentLocationTrackingConsent } from '../types/agentLocationConsent';

export async function isOsForegroundLocationGranted(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  return fg.status === Location.PermissionStatus.GRANTED;
}

export function canUseLocationFeatures(
  consent: AgentLocationTrackingConsent,
  osForegroundGranted: boolean
): boolean {
  return consent === 'accepted' && osForegroundGranted;
}

export function isLocationRestricted(consent: AgentLocationTrackingConsent): boolean {
  return consent !== 'accepted';
}
