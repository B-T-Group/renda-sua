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

export const SIGNUP_AI_REEL_TOKENS = 1;

/** @deprecated Prefer reelAiTokenCost — kept for pack/signup docs. */
export const REEL_AI_TOKEN_COST = 1;

export type ReelAiVeoTier = 'fast' | 'standard';

/**
 * Token cost for one AI reel (Gemini Veo native audio is always on).
 * fast=1, standard=4.
 */
export function reelAiTokenCost(tier: ReelAiVeoTier): number {
  if (tier === 'fast') return 1;
  return 4;
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
