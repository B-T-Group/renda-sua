export type ReelAiVeoTier = 'lite' | 'fast' | 'standard';

/** Mirrors backend reelAiTokenCost for UI cost display. */
export function reelAiTokenCost(params: {
  tier: ReelAiVeoTier;
  generateAudio: boolean;
}): number {
  if (params.generateAudio) {
    if (params.tier === 'lite') return 1;
    if (params.tier === 'fast') return 2;
    return 8;
  }
  if (params.tier === 'fast') return 1;
  return 4;
}

export function tiersForAudio(
  generateAudio: boolean,
  isSuperuser: boolean
): ReelAiVeoTier[] {
  if (isSuperuser || generateAudio) return ['lite', 'fast', 'standard'];
  return ['fast', 'standard'];
}
