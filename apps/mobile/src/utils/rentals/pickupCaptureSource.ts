/** Pickup with the rules flag opens the camera or the Settings prompt, never the library. */
export function pickupCaptureSource(cameraOnly: boolean, cameraGranted: boolean): 'camera' | 'library' | 'denied' {
  if (cameraOnly) return cameraGranted ? 'camera' : 'denied';
  return cameraGranted ? 'camera' : 'library';
}
