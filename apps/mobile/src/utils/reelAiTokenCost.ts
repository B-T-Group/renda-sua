export type ReelAiVeoTier = 'fast' | 'standard';

export const REEL_AI_VEO_TIERS: ReelAiVeoTier[] = ['fast', 'standard'];

/**
 * Token cost for one AI reel (native audio always on via Gemini Veo).
 * fast=2, standard=8.
 */
export function reelAiTokenCost(tier: ReelAiVeoTier): number {
  if (tier === 'fast') return 2;
  return 8;
}
