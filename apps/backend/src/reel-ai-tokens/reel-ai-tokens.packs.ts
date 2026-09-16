export type ReelAiTokenPackId =
  | 'reel_ai_pack_1'
  | 'reel_ai_pack_5'
  | 'reel_ai_pack_15';

export interface ReelAiTokenPack {
  id: ReelAiTokenPackId;
  tokens: number;
  prices: { CAD: number; XAF: number };
}

/** 1500 XAF per token; CAD at 400 XAF = 1 CAD. */
export const REEL_AI_TOKEN_PACKS: ReelAiTokenPack[] = [
  { id: 'reel_ai_pack_1', tokens: 1, prices: { CAD: 3.75, XAF: 1500 } },
  { id: 'reel_ai_pack_5', tokens: 5, prices: { CAD: 18.75, XAF: 7500 } },
  { id: 'reel_ai_pack_15', tokens: 15, prices: { CAD: 56.25, XAF: 22500 } },
];

export const SIGNUP_AI_REEL_TOKENS = 2;

/** @deprecated Prefer reelAiTokenCost — kept for pack/signup docs. */
export const REEL_AI_TOKEN_COST = 1;

export type ReelAiVeoTier = 'lite' | 'fast' | 'standard';

/**
 * Token cost for one AI reel generate.
 * With audio: lite=1, fast=2, standard=8.
 * Without audio: fast=1, standard=4 (lite not allowed).
 */
export function reelAiTokenCost(params: {
  tier: ReelAiVeoTier;
  generateAudio: boolean;
}): number {
  if (params.generateAudio) {
    if (params.tier === 'lite') return 1;
    if (params.tier === 'fast') return 2;
    return 8;
  }
  if (params.tier === 'lite') {
    throw new Error('Lite tier requires audio');
  }
  if (params.tier === 'fast') return 1;
  return 4;
}

export function isReelAiTierAudioAllowed(
  tier: ReelAiVeoTier,
  generateAudio: boolean
): boolean {
  if (generateAudio) return true;
  return tier === 'fast' || tier === 'standard';
}

export function getReelAiTokenPack(
  packId: string
): ReelAiTokenPack | undefined {
  return REEL_AI_TOKEN_PACKS.find((pack) => pack.id === packId);
}

export function findReelAiPackByAmount(
  amount: number,
  currency: string
): ReelAiTokenPack | undefined {
  const code = currency.toUpperCase() as 'CAD' | 'XAF';
  return REEL_AI_TOKEN_PACKS.find((pack) => {
    const price = pack.prices[code];
    return price !== undefined && Math.abs(price - amount) < 0.001;
  });
}

export function resolvePurchasedReelAiPack(params: {
  amount: number;
  currency: string;
}): ReelAiTokenPack | undefined {
  return findReelAiPackByAmount(params.amount, params.currency);
}

export function reelAiPackPriceForCurrency(
  pack: ReelAiTokenPack,
  currency: string
): number | null {
  const code = currency.toUpperCase();
  if (code === 'CAD' || code === 'XAF') {
    return pack.prices[code];
  }
  return null;
}
