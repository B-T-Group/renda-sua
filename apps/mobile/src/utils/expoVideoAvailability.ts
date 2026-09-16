import { requireOptionalNativeModule } from 'expo-modules-core';

/** True when the installed native binary includes expo-video (ExpoVideo). */
export function isExpoVideoAvailable(): boolean {
  try {
    return requireOptionalNativeModule('ExpoVideo') != null;
  } catch {
    return false;
  }
}
