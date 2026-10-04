export type HapticKind = 'selection' | 'success' | 'warning' | 'impactLight';

/** Web has no tactile hardware here, and reduce-motion means stay quiet. */
export function hapticAllowed(platform: string, reduceMotion: boolean): boolean {
  return platform !== 'web' && !reduceMotion;
}
