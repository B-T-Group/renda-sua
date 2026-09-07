import * as Location from 'expo-location';

export type OsPermissionSnapshot = {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
};

export async function readOsLocationPermissions(): Promise<OsPermissionSnapshot> {
  const [fg, bg] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return { foreground: fg.status, background: bg.status };
}

export function osPermGranted(status: Location.PermissionStatus): boolean {
  return status === Location.PermissionStatus.GRANTED;
}

export async function requestForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === Location.PermissionStatus.GRANTED) {
    return true;
  }
  const req = await Location.requestForegroundPermissionsAsync();
  return req.status === Location.PermissionStatus.GRANTED;
}

export async function requestBackgroundPermission(): Promise<boolean> {
  const current = await Location.getBackgroundPermissionsAsync();
  if (current.status === Location.PermissionStatus.GRANTED) {
    return true;
  }
  await Location.requestBackgroundPermissionsAsync();
  const after = await Location.getBackgroundPermissionsAsync();
  return after.status === Location.PermissionStatus.GRANTED;
}

/** Request OS permissions after consent is saved as accepted. Does not mutate consent. */
export async function runAgentLocationPermissionFlow(): Promise<boolean> {
  const fgOk = await requestForegroundPermission();
  if (!fgOk) {
    return false;
  }
  await requestBackgroundPermission();
  return true;
}
