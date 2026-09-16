export type ReelAiVeoTier = 'lite' | 'fast' | 'standard';

export const REEL_AI_VEO_TIERS: ReelAiVeoTier[] = ['lite', 'fast', 'standard'];

/**
 * Token cost for one AI reel (native audio always on via Gemini Veo).
 * lite=1, fast=2, standard=8.
 */
export function reelAiTokenCost(tier: ReelAiVeoTier): number {
  if (tier === 'lite') return 1;
  if (tier === 'fast') return 2;
  return 8;
}
