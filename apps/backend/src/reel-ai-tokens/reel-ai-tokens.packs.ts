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
export const REEL_AI_TOKEN_COST = 1;

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

export function findReelAiPackByDescription(
  description: string | null | undefined
): ReelAiTokenPack | undefined {
  if (!description) return undefined;
  const match = description.match(/AI reel tokens(?: pack)?\s+(\d+)/i);
  if (!match) return undefined;
  const tokens = Number.parseInt(match[1], 10);
  return REEL_AI_TOKEN_PACKS.find((pack) => pack.tokens === tokens);
}

export function resolvePurchasedReelAiPack(params: {
  amount: number;
  currency: string;
  description?: string | null;
}): ReelAiTokenPack | undefined {
  return (
    findReelAiPackByAmount(params.amount, params.currency) ||
    findReelAiPackByDescription(params.description)
  );
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
