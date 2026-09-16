export type ReelAiVeoTier = 'fast' | 'standard';

export const REEL_AI_VEO_TIERS: ReelAiVeoTier[] = ['fast', 'standard'];

/**
 * Token cost for one AI reel (native audio always on via Gemini Veo).
 * fast=1, standard=4.
 */
export function reelAiTokenCost(tier: ReelAiVeoTier): number {
  if (tier === 'fast') return 1;
  return 4;
}
